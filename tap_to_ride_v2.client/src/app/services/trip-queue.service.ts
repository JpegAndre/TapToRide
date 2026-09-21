import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase, DBSchema } from 'idb';
import { Subject } from 'rxjs';
import { PendingBatch, TripDto } from '../models/trip.model';

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

  constructor() {
    this.dbPromise = openDB<TapDb>('taptoride', 1, {
      upgrade(db) {
        db.createObjectStore('batches', { keyPath: 'batchId' });
      }
    });
  }

  async recordFare(riderId: string, fareCents: number): Promise<void> {
    const trip: TripDto = {
      tripId: crypto.randomUUID(),
      riderId,
      fareCents,
      takenAt: new Date().toISOString(),
      signature: 'placeholder'
    };

    
    const tx = (await this.dbPromise).transaction('batches', 'readwrite');
    const open = (await tx.store.getAll()).find(b => !b.sealed); // at most one open batch at a time
    if (open) {
      open.trips.push(trip);
      await tx.store.put(open);
    } else {
      await tx.store.put({ batchId: crypto.randomUUID(), trips: [trip] });
    }
    await tx.done;

    this.changed$.next();
  }

  async sealOpenBatch(): Promise<void> {
    const tx = (await this.dbPromise).transaction('batches', 'readwrite');
    const open = (await tx.store.getAll()).find(b => !b.sealed && b.trips.length > 0);
    if (open) {
      open.sealed = true;
      await tx.store.put(open);
    }
    await tx.done;
  }

  async unsentCount(): Promise<number> {
    const all = await (await this.dbPromise).getAll('batches');
    return all.reduce((n, b) => n + b.trips.length, 0);
  }

  async pendingBatches(): Promise<PendingBatch[]> {
    return (await this.dbPromise).getAll('batches');
  }

  async sealedBatches(): Promise<PendingBatch[]> {
    return (await this.pendingBatches()).filter(b => b.sealed);
  }

  async markSettled(batchId: string): Promise<void> {
    await (await this.dbPromise).delete('batches', batchId);
    this.changed$.next();
  }
}
