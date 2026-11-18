import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://8f78c22f751af6a5c2e9e4f93c8cb3f1@o4512453640388608.ingest.de.sentry.io/4512453655461968",
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
