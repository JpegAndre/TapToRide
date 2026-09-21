import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

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

  private changedSub?: Subscription;

  constructor(private queue: TripQueueService) { }

  ngOnInit(): void {
    this.changedSub = this.queue.changed$.subscribe(() => this.refresh());
    this.refresh();
  }

  ngOnDestroy(): void {
    this.changedSub?.unsubscribe();
  }

  private async refresh(): Promise<void> {
    this.payload = JSON.stringify(await this.queue.pendingBatches(), null, 2);
  }
}
