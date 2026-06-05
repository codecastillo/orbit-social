# Orbit operational runbook

Operational reference for the Orbit app: Next.js 16 App Router on Vercel, Supabase
Postgres, Mux for live and VOD, Resend for email, Sentry for errors.
If an entry here diverges from the code, fix the code or this file to match.

## Stack at a glance

- Frontend and API: Next.js (`next` 16), deployed on Vercel.
- Database and auth: Supabase (Postgres + Auth). The app accesses it via `@supabase/ssr`
  in middleware and server code, plus a service-role admin client
  (`src/lib/supabase/admin.ts`) for privileged work (cron, Mux webhook).
- Video: Mux (`@mux/mux-node`) for live streams and recorded VODs.
- Email: Resend (`resend`) via the Supabase auth email hook and notification jobs.
- Errors: Sentry (`@sentry/nextjs`), wired in `src/instrumentation.ts` (server and
  edge) and `src/instrumentation-client.ts` (browser).
- Scheduled work: Vercel Cron, declared in `vercel.json`, served from
  `src/app/api/cron/*`.

## Deploy

Deploys are driven by Vercel from `git push`. GitHub Actions
(`.github/workflows/ci.yml`) runs lint and typecheck on every push and PR;
Vercel's own build, which runs with real environment variables, is the gate for
the deploy itself.

1. Push to `main`. Vercel builds and promotes the result to Production for the
   linked project. Pushes to other branches produce Preview deployments.
2. Confirm the build went green in the Vercel dashboard (Deployments tab) or with
   `vercel ls`.
3. Vercel Cron jobs only run on Production deployments. After the first Production
   deploy, the five entries in `vercel.json` appear under Settings, Cron Jobs. If
   they are missing, the build did not pick up `vercel.json`; redeploy.

A deploy is not done until the Production build is green and a smoke check passes
(load the app, hit one authorized cron route, see the expected JSON).

## Roll back

Vercel keeps every prior build immutable, so rollback is re-promoting an older one.

- Dashboard: Deployments, find the last known-good deployment, use "Promote to
  Production" (or the rollback action). This is effectively instant; no rebuild.
- CLI: `vercel rollback` reverts Production to the previous deployment. Pass a
  specific deployment URL to target a particular build.

Application code is stateless between deploys, but the database is not. If a deploy
shipped a Supabase migration, rolling back the app does not roll back the schema.
Migrations here are written to be additive and reversible where possible; if you
roll the app back across a schema change, confirm the older code still works
against the newer schema before promoting.

## Where to look when things break

- Vercel runtime logs: Project, Logs (or `vercel logs <deployment-url>`). Function
  errors, cron invocations and their status codes, and `console.error` output from
  routes (the Mux webhook and cron jobs log failures here) land here.
- Sentry: exceptions and traces when `NEXT_PUBLIC_SENTRY_DSN` is set; without it,
  `register()` in `src/instrumentation.ts` skips initialization entirely and no
  errors are captured. Trace sampling is 10% (`tracesSampleRate: 0.1`); session
  replay is off except on error. Two Supabase auth-lock messages are intentionally
  filtered as non-actionable noise (see `ignoreErrors` in `src/instrumentation-client.ts`).
- Supabase logs: Supabase dashboard, Logs tab (Postgres, Auth, and API). Use for RLS
  denials, failed RPCs (cron calls functions like `publish_due_scheduled_posts`),
  auth and email-hook failures, and connection issues. Inspect schema and aggregate
  counts only; never read user rows or PII while debugging.

## Top failure modes

These are inferable from the code; check them first.

1. Missing or wrong environment variable. Several paths fail hard by design:
   `getMux()` throws if `MUX_TOKEN_ID` or `MUX_TOKEN_SECRET` is unset; the cron
   guard returns 500 ("CRON_SECRET not configured on server") if `CRON_SECRET` is
   missing; the middleware uses `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` and will not authenticate sessions without them.
   Symptom: 500s or redirect loops right after a deploy to a new environment.
   Fix: set the variable in Vercel for that environment and redeploy.

2. Cron jobs returning 401. Vercel sends `Authorization: Bearer ${CRON_SECRET}`
   to each cron path only when `CRON_SECRET` is set on the project. If the secret
   on Vercel and the secret the guard reads differ, every cron run 401s and
   scheduled work silently stops (scheduled posts never publish, reminders and
   digests never send). Verify by curling a cron route with the header (see Smoke
   checks); a correct secret returns 200, a wrong or absent one returns 401.

3. Supabase outage or RLS change. The middleware calls Supabase on every page
   request, so a Supabase outage degrades all page traffic, and cron jobs that run
   RPCs through the admin client fail. A bad RLS or policy migration can lock out
   reads or writes app-wide. Check Supabase status and recent migrations; if a
   migration is the cause, roll it forward with a fix rather than editing the live
   schema by hand.

4. Mux webhook failures. `POST /api/mux/webhook` verifies the `mux-signature`
   header against `MUX_WEBHOOK_SECRET` (via `unwrapMuxWebhook`) and returns 401 on
   a bad or missing signature. If the secret is wrong, every webhook is rejected:
   live streams never flip to `live`/`ended` and recorded VODs are never inserted
   into `live_vods`, even though playback worked. The handler also returns 500 on a
   Supabase lookup, update, or insert error (logged to Vercel). Confirm the secret
   matches the value configured in the Mux dashboard and check Vercel logs for the
   route.

5. Email not delivering. Auth and notification email goes through Resend. If
   `RESEND_API_KEY` or `RESEND_FROM` is wrong, or the Supabase auth email hook is
   misconfigured (`SUPABASE_AUTH_HOOK_SECRET`), verification and notification mail
   stops. Check the Resend dashboard for delivery and the Supabase Auth logs for
   hook errors.

## Required environment variables

By name only. Never commit real values; set them per environment in Vercel.

Server (Production and Preview):

- `CRON_SECRET` (authorizes Vercel Cron calls to `/api/cron/*`)
- `SUPABASE_SERVICE_ROLE_KEY` (service-role admin client)
- `SUPABASE_AUTH_HOOK_SECRET` (Supabase auth email hook signature)
- `RESEND_API_KEY`
- `RESEND_FROM`
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SECRET`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Public (`NEXT_PUBLIC_*`, exposed to the browser bundle):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SENTRY_DSN` (optional; error capture is off when unset)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (optional; CAPTCHA is skipped when unset)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

Provided by Vercel at build and runtime, referenced for Sentry environment and
release tagging: `VERCEL_ENV`, `NEXT_PUBLIC_VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`,
`NODE_ENV`. You do not set these by hand.

## Smoke checks

Each cron route returns 200 with a JSON body when authorized, and 401 without the
header. The cron paths are declared in `vercel.json`:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" https://<prod-domain>/api/cron/publish-scheduled-posts
curl -H "Authorization: Bearer $CRON_SECRET" https://<prod-domain>/api/cron/event-reminders
curl -H "Authorization: Bearer $CRON_SECRET" https://<prod-domain>/api/cron/cleanup-stories
curl -H "Authorization: Bearer $CRON_SECRET" https://<prod-domain>/api/cron/cleanup-login-activity
curl -H "Authorization: Bearer $CRON_SECRET" https://<prod-domain>/api/cron/notification-digest
```

Drop the header and confirm you get 401.
