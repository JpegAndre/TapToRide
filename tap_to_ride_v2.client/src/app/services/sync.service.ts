import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, interval, Subscription, BehaviorSubject, Subject } from 'rxjs';
import { TripQueueService } from './trip-queue.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  status$ = new BehaviorSubject<boolean>(false);

  /** Fires when a batch was accepted, i.e. the server's settled totals moved. */
  settled$ = new Subject<void>();

  private sub?: Subscription;
  private intervalMs = 3000;
  private lastLogged?: boolean;

  constructor(private http: HttpClient, private queue: TripQueueService) { }

  /** How long until the next attempt, for the "retrying in Xs" message. */
  get retrySeconds(): number { return Math.round(this.intervalMs / 1000); }

  start(intervalMs = 3000): void {
    this.intervalMs = intervalMs;
    this.sub = interval(intervalMs).subscribe(() => this.trySync());
    this.trySync();
  }

  stop(): void { this.sub?.unsubscribe(); }

  private async trySync(): Promise<void> {
    if (!await this.serverReachable()) {
      this.setStatus(false);
      return;
    }
    this.setStatus(true);

    // Freeze whatever has accumulated, then send. Fares tapped from here on go
    // to a fresh batch, so nothing is added to a batchId the server has seen.
    await this.queue.sealOpenBatch();

    let anySettled = false;

    for (const batch of await this.queue.sealedBatches()) {
      try {
        // Posted field by field: `sealed` is local bookkeeping and must not
        // appear on the wire, where the server expects exactly BatchDto.
        await firstValueFrom(this.http.post(`${environment.apiUrl}/batches`, {
          batchId: batch.batchId,
          trips: batch.trips
        }));
        await this.queue.markSettled(batch.batchId);
        anySettled = true;
      } catch {
        this.setStatus(false);
        if (anySettled) { this.settled$.next(); } // some did land before the failure
        return; // leave the rest queued, retry everything on the next tick
      }
    }

    if (anySettled) { this.settled$.next(); }
  }

  private async serverReachable(): Promise<boolean> {
    try {
      await firstValueFrom(this.http.get(`${environment.apiUrl}/health`));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Emits on every tick so subscribers can refresh their counters, but logs only
   * when the state actually changes — a long outage shouldn't spam the console.
   */
  private setStatus(ok: boolean): void {
    if (this.lastLogged !== ok) {
      this.lastLogged = ok;
      console.info(ok
        ? 'Server reachable — syncing queued fares.'
        : `Server unreachable — fares are being saved locally, retrying in ${this.retrySeconds}s.`);
    }

    this.status$.next(ok);
  }
}
