import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { bootstrapSentry } from './app/core/observability/sentry.bootstrap';

// Init Sentry before Angular boots so it can capture errors from the
// bootstrap pipeline itself. No-op when window.__SENTRY_DSN__ is unset
// or @sentry/angular isn't installed.
void bootstrapSentry();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
