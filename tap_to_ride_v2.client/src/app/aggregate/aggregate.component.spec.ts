import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AggregateComponent } from './aggregate.component';
import { SyncService } from '../services/sync.service';

describe('AggregateComponent', () => {
  let component: AggregateComponent;
  let fixture: ComponentFixture<AggregateComponent>;
  let http: HttpTestingController;
  let sync: SyncService;

  const charges = [{ id: 1, riderId: 'rider-001', totalCents: 2500, date: '2026-09-21' }];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AggregateComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AggregateComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    sync = TestBed.inject(SyncService);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  /** Lets the component's async refresh settle before asserting on it. */
  const flushed = () => new Promise(resolve => setTimeout(resolve));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not fetch while the server is unreachable', () => {
    sync.status$.next(false);

    http.expectNone('/api/riders/charges');
  });

  it('fetches when the server first becomes reachable', async () => {
    sync.status$.next(true);
    http.expectOne('/api/riders/charges').flush(charges);
    await flushed();

    expect(JSON.parse(component.payload)).toEqual(charges);
  });

  it('does not refetch on every tick while it stays online', () => {
    sync.status$.next(true);
    http.expectOne('/api/riders/charges').flush(charges);

    sync.status$.next(true);
    http.expectNone('/api/riders/charges');
  });

  it('refetches when a batch settles', async () => {
    sync.status$.next(true);
    http.expectOne('/api/riders/charges').flush([]);

    sync.settled$.next();
    http.expectOne('/api/riders/charges').flush(charges);
    await flushed();

    expect(JSON.parse(component.payload)).toEqual(charges);
  });

  it('keeps the last totals when a refresh fails', async () => {
    sync.status$.next(true);
    http.expectOne('/api/riders/charges').flush(charges);
    await flushed();

    sync.settled$.next();
    http.expectOne('/api/riders/charges')
      .flush({ status: 'offline' }, { status: 503, statusText: 'Service Unavailable' });
    await flushed();

    expect(JSON.parse(component.payload)).toEqual(charges);
  });
});
