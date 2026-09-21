import { Component } from '@angular/core';
import { InputComponent } from './input/input.component';
import { BreakdownComponent } from './breakdown/breakdown.component';
import { AggregateComponent } from './aggregate/aggregate.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  // add app-input to imports so that it can be used in the app.component.html
  imports: [InputComponent, BreakdownComponent, AggregateComponent],
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'tap_to_ride_v2.client';
}
