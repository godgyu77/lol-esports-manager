import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;
const environment = import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE;

let initialized = false;

export function initializeMonitoring() {
  if (initialized || !dsn) return;

  Sentry.init({
    dsn,
    environment,
    enabled: Boolean(dsn),
    sendDefaultPii: false,
    integrations: [],
  });

  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, string>) {
  if (!initialized) return;

  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => scope.setTag(key, value));
    }
    Sentry.captureException(error);
  });
}
