import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, interval, Subscription, BehaviorSubject, Subject } from 'rxjs';
import { TripQueueService } from './trip-queue.service';
import { CryptoService } from './crypto.service';
import { describeHttpError } from './http-error';
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

  constructor(
    private http: HttpClient,
    private queue: TripQueueService,
    private signer: CryptoService) { }

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

    // The server is up, so this is the moment enrollment can succeed. Anything
    // captured while offline gets its signature when the batch below is sealed.
    await this.signer.ensureEnrolled();

    // Freeze whatever has accumulated, then send. Fares tapped from here on go
    // to a fresh batch, so nothing is added to a batchId the server has seen.
    await this.queue.sealOpenBatch();

    let anySettled = false;

    for (const batch of await this.queue.sealedBatches()) {
      try {
        // Posted field by field: `sealed`, `rejected` and a trip's `unsigned` flag are
        // local bookkeeping and must not appear on the wire, where the server expects
        // exactly BatchDto.
        await firstValueFrom(this.http.post(`${environment.apiUrl}/batches`, {
          batchId: batch.batchId,
          deviceId: batch.deviceId,
          trips: batch.trips.map(t => ({
            tripId: t.tripId,
            riderId: t.riderId,
            fareCents: t.fareCents,
            takenAt: t.takenAt,
            signature: t.signature
          }))
        }));
        await this.queue.markSettled(batch.batchId);
        anySettled = true;
      } catch (err) {
        // A refusal is about this batch, not the connection. Retrying it forever would
        // block every batch queued behind it, so park it and keep draining.
        if (isPermanentRejection(err)) {
          await this.queue.markRejected(batch.batchId, describeRejection(err));
          continue;
        }

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

/**
 * True when the server understood the batch and said no. Status 0 is a connection
 * that never landed, and `ng serve` turns a refused connection into a 503 sentinel
 * (see http-error.ts) — both are transient and must stay retryable.
 */
function isPermanentRejection(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status >= 400 && err.status < 500;
}

function describeRejection(err: unknown): string {
  const reason = err instanceof HttpErrorResponse ? err.error?.reason : null;
  return typeof reason === 'string' ? reason : describeHttpError(err);
}
