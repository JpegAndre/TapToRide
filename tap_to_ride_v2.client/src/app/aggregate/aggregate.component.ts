import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { SyncService } from '../services/sync.service';

@Component({
  selector: 'app-aggregate',
  standalone: true,
  templateUrl: './aggregate.component.html',
  styleUrl: './aggregate.component.css'
})
export class AggregateComponent implements OnInit, OnDestroy {
  /** Today's settled charges, exactly as the server returned them. */
  payload = '[]';

  private subs = new Subscription();
  private wasOnline = false;

  constructor(private http: HttpClient, private sync: SyncService) { }

  ngOnInit(): void {
    // A batch landing is the only thing this terminal does that moves the totals.
    this.subs.add(this.sync.settled$.subscribe(() => this.refresh()));

    // Reconnecting is the other: the server may have changed while we were away,
    // and this doubles as the initial load once the first probe succeeds.
    this.subs.add(this.sync.status$.subscribe(online => {
      if (online && !this.wasOnline) { this.refresh(); }
      this.wasOnline = online;
    }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private async refresh(): Promise<void> {
    try {
      const charges = await firstValueFrom(this.http.get(`${environment.apiUrl}/riders/charges`));
      this.payload = JSON.stringify(charges, null, 2);
    } catch {
      // Keep the last good totals on screen; the terminal's status pill already
      // reports that the server is unreachable.
    }
  }
}
