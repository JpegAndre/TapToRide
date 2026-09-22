import {
  canonicalMessage, fromBase64Url, signCanonical, toBase64Url, SignableTrip
} from './crypto.service';

/**
 * The shared known-answer vector. TripSignatureTests.cs asserts these exact strings
 * against the C# implementation — if the two canonical forms or base64url encodings
 * ever drift apart, one of the two suites goes red instead of production going quiet.
 */
const VECTOR = {
  secret: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8',
  keyId: 'test-key',
  deviceId: '11111111-1111-4111-8111-111111111111',
  trip: {
    tripId: '22222222-2222-4222-8222-222222222222',
    riderId: 'rider-001',
    fareCents: 250,
    takenAt: '2026-01-02T03:04:05.678Z'
  } as SignableTrip,
  canonical:
    'v1|11111111-1111-4111-8111-111111111111|22222222-2222-4222-8222-222222222222|rider-001|250|2026-01-02T03:04:05.678Z',
  signature: 'v1.test-key.R49Q20C6ZMdR9vdUHZO1MUHwQghRvjqDFM3fvpuuaTQ'
};

function importVectorKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', fromBase64Url(VECTOR.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

describe('canonicalMessage', () => {
  it('matches the shared known-answer vector', () => {
    expect(canonicalMessage(VECTOR.deviceId, VECTOR.trip)).toBe(VECTOR.canonical);
  });

  it('rejects a field containing the separator', () => {
    expect(() => canonicalMessage(VECTOR.deviceId, { ...VECTOR.trip, riderId: 'rider|001' }))
      .toThrowError(/must not contain/);
  });

  it('rejects an empty field', () => {
    expect(() => canonicalMessage(VECTOR.deviceId, { ...VECTOR.trip, riderId: '' }))
      .toThrowError(/must not be empty/);
  });

  it('rejects a fractional fare, which the server could not read as an int', () => {
    expect(() => canonicalMessage(VECTOR.deviceId, { ...VECTOR.trip, fareCents: 114.99999999999999 }))
      .toThrowError(/whole number/);
  });
});

describe('signCanonical', () => {
  it('produces the known-answer signature', async () => {
    const key = await importVectorKey();
    expect(await signCanonical(key, VECTOR.keyId, VECTOR.canonical)).toBe(VECTOR.signature);
  });

  it('changes when the fare changes', async () => {
    const key = await importVectorKey();
    const tampered = canonicalMessage(VECTOR.deviceId, { ...VECTOR.trip, fareCents: 1 });

    expect(await signCanonical(key, VECTOR.keyId, tampered)).not.toBe(VECTOR.signature);
  });
});

describe('base64url', () => {
  it('round-trips and is unpadded and url-safe', () => {
    const bytes = fromBase64Url(VECTOR.secret);

    expect(toBase64Url(bytes.buffer as ArrayBuffer)).toBe(VECTOR.secret);
    expect(VECTOR.secret).not.toContain('=');
  });

  it('decodes regardless of how much padding the length implies', () => {
    for (const sample of ['AQ', 'AQI', 'AQID']) {
      expect(() => fromBase64Url(sample)).not.toThrow();
    }
  });
});
