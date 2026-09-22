/** The wire contract — exactly what the server's TripDto expects, nothing more. */
export interface TripDto {
  tripId: string;
  riderId: string;
  fareCents: number;
  takenAt: string; // ISO string, and the exact text the signature covers
  signature: string;
}

/** A trip as it sits in IndexedDB, with the local bookkeeping stripped before posting. */
export interface QueuedTrip extends TripDto {
  /**
   * Set when the fare was taken before the device had a key. The trip is signed
   * retroactively at seal time; until then its batch is held back.
   */
  unsigned?: boolean;
}

export interface PendingBatch {
  batchId: string;
  trips: QueuedTrip[];
  /** Whose key signed these trips. Assigned at seal time, then sent with the batch. */
  deviceId?: string;
  sealed?: boolean;
  /** Set when the server refused the batch outright — retrying it would never succeed. */
  rejected?: boolean;
  rejectedReason?: string;
}
