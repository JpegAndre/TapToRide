export interface TripDto {
  tripId: string;
  riderId: string;
  fareCents: number;
  takenAt: string; // ISO string — matches how C# DateTime serialises over JSON
  signature: string;
}

export interface PendingBatch {
  batchId: string;
  trips: TripDto[];
  sealed?: boolean;
}
