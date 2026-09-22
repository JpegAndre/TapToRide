import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { UnsentComponent } from './unsent.component';

describe('UnsentComponent', () => {
  let component: UnsentComponent;
  let fixture: ComponentFixture<UnsentComponent>;

  beforeEach(async () => {
    // The queue it reads signs through CryptoService, which enrolls over HTTP.
    await TestBed.configureTestingModule({
      imports: [UnsentComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UnsentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
