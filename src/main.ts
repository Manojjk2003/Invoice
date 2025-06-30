import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
// Firebase services will be initialized and provided via app.config.ts
// using @angular/fire providers.

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
