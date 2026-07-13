import * as Sentry from "@sentry/nextjs";
import { getSentryPrivacyOptions } from "@/lib/observability/sentry-privacy";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  replaysSessionSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  replaysOnErrorSampleRate: 1.0,
  ...getSentryPrivacyOptions(),
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
      networkCaptureBodies: false,
      networkDetailAllowUrls: [],
      networkDetailDenyUrls: [/.*/],
      networkRequestHeaders: [],
      networkResponseHeaders: [],
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
