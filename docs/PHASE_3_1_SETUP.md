# Phase 3.1 — Sentry observability

Code is wired. Without `NEXT_PUBLIC_SENTRY_DSN` set, Sentry is a complete no-op (no errors captured, no bundle weight added past the SDK itself). To turn it on:

## 1. Create a Sentry project

1. Sign up at https://sentry.io (free tier: 5k errors/mo, no credit card).
2. Create a new project → platform **Next.js** → choose alert defaults.
3. From the project's **Settings → Client Keys (DSN)**, copy the DSN URL.
4. From **Settings → Auth Tokens**, create a token with the **`project:releases`** and **`org:read`** scopes — used for source map uploads at build time.
5. Note your **org slug** (in the URL: `sentry.io/organizations/<org-slug>/`) and your **project slug**.

## 2. Push 4 env vars to Vercel

```sh
echo "https://xxxxx@oxxxxxx.ingest.us.sentry.io/xxxxxxx" | vercel env add NEXT_PUBLIC_SENTRY_DSN production --force
echo "sntrys_xxxxxxxxxxxxxxxx"                          | vercel env add SENTRY_AUTH_TOKEN     production --force
echo "your-org-slug"                                    | vercel env add SENTRY_ORG            production --force
echo "orbit-social"                                     | vercel env add SENTRY_PROJECT        production --force
```

(Optional) push to local `.env.local` too if you want client-side errors captured during dev.

## 3. Redeploy

```sh
vercel deploy --prod --yes
```

## 4. Verify

- Sentry's **Issues** tab should show a release tag matching your latest commit SHA.
- Throw a test error from any client component, e.g. add `<button onClick={() => { throw new Error("sentry test") }}>boom</button>` to a page, click it, and confirm an issue appears in Sentry within ~10s.
- The `/monitoring` route is the tunnel — used by the client SDK to bypass ad blockers. No need to touch it.

## What's wired

- `instrumentation.ts` — Server + Edge runtime init. Captures unhandled errors in API routes, server components, server actions, and the Edge runtime middleware boundary.
- `instrumentation-client.ts` — Browser init. Captures unhandled errors, promise rejections, and (on errors only) session replay.
- `next.config.ts` — Wrapped with `withSentryConfig` only when DSN + auth token are both set. Without them, build is identical to a no-Sentry build.

## Sample rates (defaults)

- `tracesSampleRate: 0.1` — 10% of requests get performance traces. Tune up for low-traffic, down for high.
- `replaysOnErrorSampleRate: 1.0` — every error gets a 30s session replay clip.
- `replaysSessionSampleRate: 0.0` — no replays for non-error sessions (saves quota).
