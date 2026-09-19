import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase, DBSchema } from 'idb';
import { PendingBatch, TripDto } from '../models/trip.model';

interface TapDb extends DBSchema {
  batches: { key: string; value: PendingBatch };
}

@Injectable({
  providedIn: 'root'
})

  // TripQueue service only handles storing to the local IndexedDB database. It does not handle sending to or polling the server
export class TripQueueService {

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

    const db = await this.dbPromise;
    const open = (await db.getAll('batches'))[0]; // one open batch at a time — fine for a single terminal
    if (open) {
      open.trips.push(trip);
      await db.put('batches', open);
    } else {
      await db.put('batches', { batchId: crypto.randomUUID(), trips: [trip] });
    }
  }

  async unsentCount(): Promise<number> {
    const all = await (await this.dbPromise).getAll('batches');
    return all.reduce((n, b) => n + b.trips.length, 0);
  }

  async pendingBatches(): Promise<PendingBatch[]> {
    return (await this.dbPromise).getAll('batches');
  }

  async markSettled(batchId: string): Promise<void> {
    await (await this.dbPromise).delete('batches', batchId);
  }
}
