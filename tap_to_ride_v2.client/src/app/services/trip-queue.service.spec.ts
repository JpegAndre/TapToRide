import { TestBed } from '@angular/core/testing';

import { TripQueueService } from './trip-queue.service';

describe('TripQueueService', () => {
  let service: TripQueueService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TripQueueService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
