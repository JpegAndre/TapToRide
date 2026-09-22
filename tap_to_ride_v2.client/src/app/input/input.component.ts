import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';

import { SyncService } from '../services/sync.service';
import { TripQueueService } from '../services/trip-queue.service';
import { UnsentComponent } from '../unsent/unsent.component';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [FormsModule, UnsentComponent],
  templateUrl: './input.component.html',
  styleUrl: './input.component.css',
  animations: [
    trigger('fadeTick', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('400ms ease', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('400ms ease', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class InputComponent implements OnInit, OnDestroy {
  riderId = '';
  fareCents: number | null = null;
  unsent = 0;
  lastSyncOk = false;
  showTick = false;

  // Hardcoded values for now but can be trieved from an API in the future
  riders: string[] = ['rider-001', 'rider-002', 'rider-003', 'rider-004', 'rider-005'];

  private subs = new Subscription();

  constructor(private queue: TripQueueService, private sync: SyncService) { }

  ngOnInit(): void {
    this.subs.add(this.sync.status$.subscribe(ok => this.lastSyncOk = ok));

    // The counter reports on the queue, not the connection. Refreshing it off
    // status$ read the count before that tick had posted anything, leaving it a
    // full interval behind the unsent panel, which listens here.
    this.subs.add(this.queue.changed$.subscribe(() => this.refreshUnsent()));

    this.refreshUnsent();
    this.sync.start();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.sync.stop();
  }

  async recordFare(): Promise<void> {
    if (!this.riderId || this.fareCents === null) { return; }

    // Rounded because the signature covers the cents figure verbatim, and binary
    // floating point turns entries like 1.15 into 114.99999999999999.
    await this.queue.recordFare(this.riderId, Math.round(this.fareCents * 100));
    this.fareCents = null;

    this.showTick = true;

    setTimeout(() => {
      this.showTick = false;
    }, 2000);
  }

  private async refreshUnsent(): Promise<void> {
    this.unsent = await this.queue.unsentCount();
  }
}
