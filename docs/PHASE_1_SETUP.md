# Phase 1 — Email + Vercel Cron + Notification triggers

Code is committed. To make Phase 1 actually deliver mail and run cron jobs in production you need to do the following one-time setup steps.

## 1. Create a Resend account

1. Sign up at https://resend.com (free tier: 100 emails/day, no credit card).
2. Add and verify your sending domain (e.g. `mail.orbit.app`). DNS records: SPF, DKIM, DMARC. Until verified, you can only send from `onboarding@resend.dev`.
3. Generate an API key in **Settings → API Keys** with the **Sending access** scope.

## 2. Generate `CRON_SECRET`

```sh
openssl rand -hex 32
```

Save the value — you'll add it to Vercel and (optionally) `.env.local`.

## 3. Add env vars

### Local (`.env.local`)

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
RESEND_FROM="Orbit <no-reply@mail.orbit.app>"
CRON_SECRET=<your-32-byte-hex>
NEXT_PUBLIC_APP_URL=http://localhost:3001
SUPABASE_AUTH_HOOK_SECRET=<generate one — see step 5>
```

### Vercel (Production + Preview)

Same vars, plus `NEXT_PUBLIC_APP_URL` set to your production URL.

## 4. Apply the SQL migrations

```sh
supabase db push           # if linked to remote
# or
supabase migration up      # if running local Supabase
```

This applies:
- `00017_notification_triggers_fill.sql` — message / live_started / event_rsvp / event_reminder
- `00018_cron_helper_tables.sql` — `event_reminders_sent`, `email_outbox`

## 5. Configure Supabase Auth Hook (so verification emails go through Resend)

1. In Supabase Dashboard → **Authentication → Hooks → Send email hook**.
2. Choose **HTTP** type. URL: `https://<your-prod-domain>/api/auth/email-hook`.
3. Generate a webhook signing secret (Supabase will show it once). Save it to Vercel as `SUPABASE_AUTH_HOOK_SECRET`.
4. Enable the hook.

When the hook is on, signup, password-reset, magic-link, and email-change emails are dispatched through `/api/auth/email-hook` → Resend → Orbit-styled inbox delivery. If the hook is OFF, Supabase falls back to its default emails (basic, no Orbit branding).

## 6. Promote to Production once

Vercel Cron jobs only run in **Production** deployments. After your first production deploy, the 5 cron entries in `vercel.json` will be visible at:

**Vercel dashboard → Project → Settings → Cron Jobs**

If they don't show up there, the build didn't pick up `vercel.json` — re-deploy.

## 7. Smoke test

```sh
# Each cron route returns 200 + a JSON body when authorized
curl -H "Authorization: Bearer $CRON_SECRET" https://your-prod-domain/api/cron/publish-scheduled-posts
curl -H "Authorization: Bearer $CRON_SECRET" https://your-prod-domain/api/cron/event-reminders
curl -H "Authorization: Bearer $CRON_SECRET" https://your-prod-domain/api/cron/cleanup-stories
curl -H "Authorization: Bearer $CRON_SECRET" https://your-prod-domain/api/cron/cleanup-login-activity
curl -H "Authorization: Bearer $CRON_SECRET" https://your-prod-domain/api/cron/notification-digest
```

Without the auth header you should get **401**.

## 8. Functional checks

- **Sign up new user** → Resend dashboard shows delivered email; clicking the link confirms the account.
- **Insert a message** in a conversation → recipients get a `notifications` row of type `message`.
- **Update a `live_streams` row** to `status='live'` → all followers get a `live_started` notification.
- **RSVP to an event** as another user → the host gets an `event_invite` notification.
- **Schedule an event** with `start_at = now() + 10 min` → within one cron tick attendees receive `event_reminder`.
- **Schedule a post** for 5 min from now → cron auto-publishes it; row's `is_hidden` flips to false.
