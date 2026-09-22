import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase, DBSchema } from 'idb';
import { Subject } from 'rxjs';
import { PendingBatch, QueuedTrip } from '../models/trip.model';
import { CryptoService } from './crypto.service';

interface TapDb extends DBSchema {
  batches: { key: string; value: PendingBatch };
}

@Injectable({
  providedIn: 'root'
})

  // TripQueue service only handles storing to the local IndexedDB database. It does not handle sending to or polling the server
export class TripQueueService {

  /** Fires after any write, so views showing the queue can refresh themselves. */
  changed$ = new Subject<void>();

  private dbPromise: Promise<IDBPDatabase<TapDb>>;

  constructor(private signer: CryptoService) {
    this.dbPromise = openDB<TapDb>('taptoride', 1, {
      upgrade(db) {
        db.createObjectStore('batches', { keyPath: 'batchId' });
      }
    });
  }

  async recordFare(riderId: string, fareCents: number): Promise<void> {
    const trip: QueuedTrip = {
      tripId: crypto.randomUUID(),
      riderId,
      fareCents,
      takenAt: new Date().toISOString(),
      signature: ''
    };

    // Signed before the transaction opens, never inside it: awaiting WebCrypto yields
    // to a non-IndexedDB microtask, which closes an open IDB transaction.
    const key = await this.signer.currentKey();
    if (key) {
      trip.signature = await this.signer.signWith(key, trip);
    } else {
      // No key yet — take the fare anyway and sign it once enrollment succeeds.
      // Refusing taps until the network comes back is the worse trade.
      trip.unsigned = true;
    }

    const tx = (await this.dbPromise).transaction('batches', 'readwrite');
    // One batch, one device. A batch is verified against a single deviceId, so trips
    // signed by a re-enrolled key start a new one instead of poisoning this one.
    const open = (await tx.store.getAll()).find(b =>
      !b.sealed && !b.rejected && (b.deviceId === undefined || b.deviceId === key?.deviceId));
    if (open) {
      open.deviceId ??= key?.deviceId;
      open.trips.push(trip);
      await tx.store.put(open);
    } else {
      await tx.store.put({ batchId: crypto.randomUUID(), deviceId: key?.deviceId, trips: [trip] });
    }
    await tx.done;

    this.changed$.next();
  }

  /**
   * Freezes the open batch so it can be posted. A batch holding trips that still
   * can't be signed is left open: sending it would earn a permanent rejection, and
   * the fares are safer waiting here for a key than being refused by the server.
   */
  async sealOpenBatch(): Promise<void> {
    const key = await this.signer.currentKey();
    if (!key) { return; }

    const db = await this.dbPromise;
    const open = (await db.getAll('batches'))
      .find(b => !b.sealed && !b.rejected && b.trips.length > 0);
    if (!open) { return; }

    // The batch travels under the device that signed its trips, which is not
    // necessarily the current one if the key was reissued since.
    open.deviceId ??= key.deviceId;

    if (open.deviceId === key.deviceId) {
      // Again outside any transaction — see recordFare.
      for (const trip of open.trips) {
        if (trip.unsigned) {
          trip.signature = await this.signer.signWith(key, trip);
          delete trip.unsigned;
        }
      }
    }

    // Anything still unsigned would earn the whole batch a permanent rejection, so
    // the batch waits here instead. Holding fares is recoverable; having them
    // refused is not.
    if (open.trips.some(t => t.unsigned)) { return; }

    open.sealed = true;
    await db.put('batches', open);
  }

  async unsentCount(): Promise<number> {
    const all = await (await this.dbPromise).getAll('batches');
    return all.reduce((n, b) => n + b.trips.length, 0);
  }

  async pendingBatches(): Promise<PendingBatch[]> {
    return (await this.dbPromise).getAll('batches');
  }

  /** Rejected batches are excluded: they are sealed, but resending them is pointless. */
  async sealedBatches(): Promise<PendingBatch[]> {
    return (await this.pendingBatches()).filter(b => b.sealed && !b.rejected);
  }

  async rejectedBatches(): Promise<PendingBatch[]> {
    return (await this.pendingBatches()).filter(b => b.rejected);
  }

  /**
   * Parks a batch the server refused. Kept rather than deleted so the fares are still
   * visible and recoverable by hand — dropping them would be silent data loss.
   */
  async markRejected(batchId: string, reason: string): Promise<void> {
    const db = await this.dbPromise;
    const batch = await db.get('batches', batchId);
    if (!batch) { return; }

    batch.rejected = true;
    batch.rejectedReason = reason;
    await db.put('batches', batch);

    console.error(`Batch ${batchId} refused by the server (${reason}) — it will not be retried.`);
    this.changed$.next();
  }

  async markSettled(batchId: string): Promise<void> {
    await (await this.dbPromise).delete('batches', batchId);
    this.changed$.next();
  }
}
