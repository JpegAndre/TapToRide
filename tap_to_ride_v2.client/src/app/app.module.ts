import { provideHttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { InputComponent } from './input/input.component';

@NgModule({
  imports: [
    BrowserModule,
    AppRoutingModule,
    AppComponent,
    InputComponent
  ],
  providers: [
    provideHttpClient(),
    provideAnimations()
  ],
  bootstrap: [AppComponent],
  declarations: []
})
export class AppModule { }
