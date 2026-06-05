import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    integrations: [Sentry.replayIntegration()],
    // supabase-js holds the auth token in a Web Lock with steal:true so the
    // most-recent tab wins. When another tab takes over, the previous lock
    // throws "Lock broken by another request with the 'steal' option." /
    // "Lock 'lock:sb-…-auth-token' was released because another request
    // stole it" are both non-actionable noise. Drop them at the edge.
    ignoreErrors: [
      /Lock broken by another request with the 'steal' option/i,
      /Lock "lock:sb-.*-auth-token" was released because another request stole it/i,
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
