import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { BreakdownComponent } from './breakdown.component';

describe('BreakdownComponent', () => {
  let component: BreakdownComponent;
  let fixture: ComponentFixture<BreakdownComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BreakdownComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BreakdownComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  /** Runs a lookup and responds with whatever the caller flushes. */
  async function lookup(respond: (req: ReturnType<HttpTestingController['expectOne']>) => void) {
    component.riderId = 'rider-001';
    const done = component.lookup();
    respond(http.expectOne('/api/riders/rider-001/trips'));
    await done;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the response as formatted JSON', async () => {
    await lookup(req => req.flush([{ tripId: 't1', riderId: 'rider-001' }]));

    expect(JSON.parse(component.payload)).toEqual([{ tripId: 't1', riderId: 'rider-001' }]);
  });

  it('reports the dev proxy\'s offline sentinel as unreachable', async () => {
    await lookup(req => req.flush({ status: 'offline' }, { status: 503, statusText: 'Service Unavailable' }));

    expect(JSON.parse(component.payload)).toEqual({ error: 'server unreachable' });
  });

  it('reports a genuine failure with its status', async () => {
    await lookup(req => req.flush('nope', { status: 404, statusText: 'Not Found' }));

    expect(JSON.parse(component.payload)).toEqual({ error: 'request failed with status 404' });
  });
});
