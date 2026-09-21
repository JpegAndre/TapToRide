import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnsentComponent } from './unsent.component';

describe('UnsentComponent', () => {
  let component: UnsentComponent;
  let fixture: ComponentFixture<UnsentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnsentComponent]
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
