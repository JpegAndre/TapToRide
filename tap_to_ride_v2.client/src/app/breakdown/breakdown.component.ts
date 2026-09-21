import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { describeHttpError } from '../services/http-error';

@Component({
  selector: 'app-breakdown',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './breakdown.component.html',
  styleUrl: './breakdown.component.css'
})
export class BreakdownComponent {
  riderId = '';
  payload = '';
  loading = false;

  constructor(private http: HttpClient) { }

  async lookup(): Promise<void> {
    const riderId = this.riderId.trim();
    if (!riderId) { return; }

    this.loading = true;
    try {
      const trips = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/riders/${encodeURIComponent(riderId)}/trips`));
      this.payload = JSON.stringify(trips, null, 2);
    } catch (err) {
      // An offline server is routine here, so the failure is rendered in the
      // panel like any other response rather than thrown.
      this.payload = JSON.stringify({ error: describeHttpError(err) }, null, 2);
    } finally {
      this.loading = false;
    }
  }
}
