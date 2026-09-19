import { Component } from '@angular/core';
import { InputComponent } from './input/input.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  // add app-input to imports so that it can be used in the app.component.html
  imports: [InputComponent],
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'tap_to_ride_v2.client';
}
