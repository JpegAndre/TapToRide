import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { SyncService } from '../services/sync.service';
import { TripQueueService } from '../services/trip-queue.service';
import { UnsentComponent } from '../unsent/unsent.component';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [FormsModule, UnsentComponent],
  templateUrl: './input.component.html',
  styleUrl: './input.component.css'
})
export class InputComponent implements OnInit, OnDestroy {
  riderId = '';
  fareCents: number | null = null;
  unsent = 0;
  lastSyncOk = false;

  // Hardcoded values for now but can be trieved from an API in the future
  riders: string[] = ['rider-001', 'rider-002', 'rider-003', 'rider-004', 'rider-005'];

  private statusSub?: Subscription;

  constructor(private queue: TripQueueService, private sync: SyncService) { }

  ngOnInit(): void {
    this.statusSub = this.sync.status$.subscribe(ok => {
      this.lastSyncOk = ok;
      this.refreshUnsent();
    });
    this.sync.start();
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
    this.sync.stop();
  }

  async recordFare(): Promise<void> {
    if (!this.riderId || this.fareCents === null) { return; }

    await this.queue.recordFare(this.riderId, this.fareCents * 100);
    this.fareCents = null;
    await this.refreshUnsent();
  }

  private async refreshUnsent(): Promise<void> {
    this.unsent = await this.queue.unsentCount();
  }
}
