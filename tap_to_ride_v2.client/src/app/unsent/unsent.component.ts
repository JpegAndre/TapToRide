import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { PendingBatch } from '../models/trip.model';
import { TripQueueService } from '../services/trip-queue.service';

@Component({
  selector: 'app-unsent',
  standalone: true,
  templateUrl: './unsent.component.html',
  styleUrl: './unsent.component.css'
})
export class UnsentComponent implements OnInit, OnDestroy {
  /** The pending batches exactly as they would be POSTed to the server. */
  payload = '[]';

  /**
   * Batches the server refused. They are no longer retried, so nothing else will
   * draw attention to them — without this they would sit in the queue unnoticed.
   */
  rejected: PendingBatch[] = [];

  private changedSub?: Subscription;

  constructor(private queue: TripQueueService) { }

  ngOnInit(): void {
    this.changedSub = this.queue.changed$.subscribe(() => this.refresh());
    this.refresh();
  }

  ngOnDestroy(): void {
    this.changedSub?.unsubscribe();
  }

  tripCount(batch: PendingBatch): number {
    return batch.trips.length;
  }

  private async refresh(): Promise<void> {
    this.payload = JSON.stringify(await this.queue.pendingBatches(), null, 2);
    this.rejected = await this.queue.rejectedBatches();
  }
}
