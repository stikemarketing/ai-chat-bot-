import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: "https://8f78c22f751af6a5c2e9e4f93c8cb3f1@o4512453640388608.ingest.de.sentry.io/4512453655461968",
      tracesSampleRate: 0,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: "https://8f78c22f751af6a5c2e9e4f93c8cb3f1@o4512453640388608.ingest.de.sentry.io/4512453655461968",
      tracesSampleRate: 0,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
