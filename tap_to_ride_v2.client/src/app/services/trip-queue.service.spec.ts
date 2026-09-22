import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { TripQueueService } from './trip-queue.service';

describe('TripQueueService', () => {
  let service: TripQueueService;

  beforeEach(() => {
    // Needed since the queue signs through CryptoService, which enrolls over HTTP.
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TripQueueService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
