import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, interval, Subscription, BehaviorSubject } from 'rxjs';
import { TripQueueService } from './trip-queue.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  status$ = new BehaviorSubject<boolean | null>(null);
  private sub?: Subscription;

  constructor(private http: HttpClient, private queue: TripQueueService) { }

  start(intervalMs = 3000): void {
    this.sub = interval(intervalMs).subscribe(() => this.trySync());
    this.trySync();
  }

  stop(): void { this.sub?.unsubscribe(); }

  private async trySync(): Promise<void> {
    const batches = await this.queue.pendingBatches();
    if (batches.length === 0) { this.status$.next(true); return; }

    for (const batch of batches) {
      try {
        await firstValueFrom(this.http.post(`${environment.apiUrl}/batches`, batch));
        await this.queue.markSettled(batch.batchId);
        this.status$.next(true);
      } catch {
        this.status$.next(false);
        return; // leave the rest queued, retry everything on the next tick
      }
    }
  }
}
