# Phase 5 — Distributed rate-limit (Upstash) + Web Push activation

Two independent sub-tracks. The Web Push code is already wired (commit `8a283f5`); only the env-var push is needed there. Upstash needs an account.

## 5a — Upstash Redis rate limiter (replaces in-memory limiter)

Currently `src/lib/rate-limit.ts:1-41` uses an in-memory `Map<string,…>` for rate limiting. That limit is per-instance (Vercel function instances each track their own counter), so you can bypass the cap by hitting different cold-start instances. Upstash gives a single shared counter.

### Setup

1. Sign up at https://upstash.com (free tier: 10k commands/day, plenty for our middleware).
2. **Console → Redis → Create Database** → name `orbit-prod` → region closest to your Vercel functions (us-east-1) → **Create**.
3. On the database detail page → **REST API** tab → copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
4. Push to Vercel:
   ```sh
   echo "https://your-db.upstash.io" | vercel env add UPSTASH_REDIS_REST_URL   production --force
   echo "<rest-token>"               | vercel env add UPSTASH_REDIS_REST_TOKEN production --force
   ```

### Code that gets added (after env is in, ask Claude to ship Phase 5a)

- `npm install @upstash/ratelimit @upstash/redis`
- Replace `src/lib/rate-limit.ts` with a sliding-window limiter backed by Upstash. Same exported API (`rateLimit(key, max, windowMs)` returns `{ success, remaining }`) so the call site in `src/lib/supabase/middleware.ts:7-31` doesn't change.
- Existing limits (20/min auth, 300/min general) carry over.

### Verification

1. Hammer `/login` with 25 POSTs in 60s from one IP (use `ab` or a small loop). 21st request returns **HTTP 429** with `Retry-After` header.
2. Restart all Vercel function instances (`vercel deploy --prod --yes` to force fresh ones). Hammer again — limit STILL holds at 20 (proves it's Redis-backed, not per-instance).

---

## 5b — Web Push (already scaffolded — just needs activation)

Code shipped in commit `8a283f5`. Service worker, subscribe/unsubscribe API, test endpoint, and client hook are in. VAPID keys already exist in `.env.local`. You just need to push them to Vercel and (optionally) wire the UI.

### Activate

```sh
# values are in your local .env.local (generated 2026-04-26 by web-push)
echo "<VAPID_PUBLIC_KEY value>"          | vercel env add VAPID_PUBLIC_KEY              production --force
echo "<VAPID_PRIVATE_KEY value>"         | vercel env add VAPID_PRIVATE_KEY             production --force
echo "mailto:dancastlebiz@gmail.com"     | vercel env add VAPID_SUBJECT                 production --force
echo "<VAPID_PUBLIC_KEY value>"          | vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY  production --force

vercel deploy --prod --yes
```

(`NEXT_PUBLIC_VAPID_PUBLIC_KEY` MUST equal `VAPID_PUBLIC_KEY` — the client uses the public-prefixed copy to mint the subscription that the server will sign with the private key.)

### UI integration (still pending)

There's no "Enable push notifications" button anywhere yet. The hook is `src/lib/hooks/use-push-subscribe.ts`. Plug it into `Settings → Notifications` and add a toggle:
```tsx
const { status, subscribe, unsubscribe } = usePushSubscribe();
```
- `status === "subscribed"` → show "Enabled" + an Unsubscribe button
- `status === "default"` → show "Enable" button → calls `subscribe()`
- `status === "denied"` → show "Permission blocked — enable in your browser settings"
- `status === "unsupported"` → hide the toggle

### Auto fan-out from notifications (still pending)

Currently no code calls `sendPush()` automatically when a `notifications` row is inserted. Two options for wiring this:
- **Supabase Database Webhook** → POSTs to a new `/api/push/dispatch?notification_id=X` route → fan out to subscriptions of `notification.user_id`. Cleanest pattern.
- **Cron-driven batch** — modify `notification-digest` cron to send pushes too. Loses real-time-ness but no extra infra.

### Verify push pipeline end-to-end

1. UI integration done → user clicks "Enable" → grants browser permission → row appears in `push_subscriptions`.
2. POST `/api/push/test` from the browser DevTools → notification pops in the OS notification center within ~2s.
3. If it doesn't pop: check `chrome://serviceworker-internals` for the worker registration, browser console for `push`-event errors, Vercel function logs for `sendNotification` errors (most common: `WebPushError: Received unexpected response code` 410 → subscription expired, route auto-deletes it).
