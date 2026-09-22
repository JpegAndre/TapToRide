import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { openDB, IDBPDatabase, DBSchema } from 'idb';

import { environment } from '../../environments/environment';

/** Bumping this invalidates every signature, so it changes only with the message format. */
export const SIGNATURE_VERSION = 'v1';

const FIELD_SEPARATOR = '|';

/** The fields of a trip that the signature covers. */
export interface SignableTrip {
  tripId: string;
  riderId: string;
  fareCents: number;
  takenAt: string;
}

export interface DeviceKeyRecord {
  deviceId: string;
  keyId: string;
  /** Stored as a CryptoKey, not bytes — see the note on `enroll`. */
  key: CryptoKey;
  issuedAt: string;
}

interface EnrollResponse {
  deviceId: string;
  keyId: string;
  secret: string;
}

interface KeyDb extends DBSchema {
  keys: { key: string; value: DeviceKeyRecord };
}

/** Only ever one active key, so it lives under a fixed name. */
const CURRENT = 'current';

/**
 * Builds the exact string that gets HMAC'd. TripSignature.Canonical on the server
 * mirrors this line for line; the known-answer test in crypto.service.spec.ts and
 * its C# twin exist to catch the two drifting apart.
 */
export function canonicalMessage(deviceId: string, trip: SignableTrip): string {
  const fields: [string, string][] = [
    ['deviceId', deviceId],
    ['tripId', trip.tripId],
    ['riderId', trip.riderId],
    ['takenAt', trip.takenAt]
  ];

  for (const [name, value] of fields) {
    if (!value) { throw new Error(`${name} must not be empty`); }
    // The separator has no escape, so a field containing it could be shifted into
    // the next one and change what a signature actually attests to.
    if (value.includes(FIELD_SEPARATOR)) {
      throw new Error(`${name} must not contain '${FIELD_SEPARATOR}'`);
    }
  }

  // Fares are cents, and the server reads them as an int. A float here would both
  // fail to deserialise and sign text that doesn't match what was meant.
  if (!Number.isInteger(trip.fareCents)) {
    throw new Error('fareCents must be a whole number of cents');
  }

  return [
    SIGNATURE_VERSION, deviceId, trip.tripId, trip.riderId, String(trip.fareCents), trip.takenAt
  ].join(FIELD_SEPARATOR);
}

/** Produces the full `signature` field value: `v1.<keyId>.<base64url mac>`. */
export async function signCanonical(key: CryptoKey, keyId: string, canonical: string): Promise<string> {
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical));
  return `${SIGNATURE_VERSION}.${keyId}.${toBase64Url(mac)}`;
}

export function toBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
  const standard = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - standard.length % 4) % 4;
  const binary = atob(standard.padEnd(standard.length + padding, '='));

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }
  return bytes;
}

@Injectable({
  providedIn: 'root'
})

  // Owns the device's signing key and nothing else. It talks to the server only to
  // enroll; posting trips stays with SyncService.
export class CryptoService {

  private dbPromise: Promise<IDBPDatabase<KeyDb>>;

  /** The key never changes once issued, so it is worth not re-reading per tap. */
  private cached?: DeviceKeyRecord;

  /** Collapses the enrollment attempts that a 3s sync tick would otherwise pile up. */
  private enrolling?: Promise<DeviceKeyRecord | null>;

  constructor(private http: HttpClient) {
    this.dbPromise = openDB<KeyDb>('taptoride-keys', 1, {
      upgrade(db) {
        db.createObjectStore('keys');
      }
    });
  }

  /** The stored key, or null if this device has never enrolled. Never hits the network. */
  async currentKey(): Promise<DeviceKeyRecord | null> {
    if (this.cached) { return this.cached; }

    this.cached = await (await this.dbPromise).get('keys', CURRENT);
    return this.cached ?? null;
  }

  /**
   * Returns the key, enrolling first if needed. Returns null when enrollment can't
   * reach the server — callers queue the trip unsigned rather than refusing the fare.
   */
  async ensureEnrolled(): Promise<DeviceKeyRecord | null> {
    const existing = await this.currentKey();
    if (existing) { return existing; }

    this.enrolling ??= this.enroll().finally(() => { this.enrolling = undefined; });
    return this.enrolling;
  }

  async sign(trip: SignableTrip): Promise<string | null> {
    const key = await this.currentKey();
    return key ? this.signWith(key, trip) : null;
  }

  /** For callers that already hold the key and are signing a run of trips. */
  signWith(key: DeviceKeyRecord, trip: SignableTrip): Promise<string> {
    return signCanonical(key.key, key.keyId, canonicalMessage(key.deviceId, trip));
  }

  private async enroll(): Promise<DeviceKeyRecord | null> {
    let response: EnrollResponse;
    try {
      response = await firstValueFrom(
        this.http.post<EnrollResponse>(`${environment.apiUrl}/devices/enroll`, {}));
    } catch {
      return null; // offline — the caller retries on a later sync tick
    }

    const secret = fromBase64Url(response.secret);

    // Imported non-extractable and stored as a CryptoKey: IndexedDB structured-clones
    // it, so what sits on disk is an opaque handle the page can sign with but cannot
    // read back. The raw bytes exist only for these few lines.
    const key = await crypto.subtle.importKey(
      'raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    secret.fill(0);

    const record: DeviceKeyRecord = {
      deviceId: response.deviceId,
      keyId: response.keyId,
      key,
      issuedAt: new Date().toISOString()
    };

    await (await this.dbPromise).put('keys', record, CURRENT);
    this.cached = record;

    console.info(`Device enrolled as ${record.deviceId} — fares are now signed.`);
    return record;
  }
}
