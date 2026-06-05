# Orbit

A full-featured social network built with Next.js App Router, Supabase, and Tailwind CSS, deployed on Vercel.

## Overview

Orbit is a full-featured social network with a ranked feed, stories, short-form video clips, real-time direct messages, communities, events, a marketplace, and live streaming. Anonymous visitors browse read-only. Signed-in users get the full experience.

Features:

- **Feed** with a ranked algorithm (recency, engagement, social proximity, boost), tab-switchable between "For You" and "Following"
- **Stories** that expire after 24 hours, cleaned up nightly by a Vercel cron job
- **Clips** (short vertical video), uploaded to Supabase Storage and surfaced in a TikTok-style scroll feed
- **Direct messages** (1:1 and group) with real-time delivery via Supabase Realtime, voice messages, emoji reactions, message pinning, and heuristic smart-reply suggestions
- **Live streaming** via Mux (RTMPS or SRT ingest, low-latency HLS playback), with ephemeral chat, virtual gifts, and VOD recording
- **P2P video and voice calls** inside DMs over WebRTC (STUN-only by default, TURN-relay path documented in `docs/PHASE_4_SETUP.md`)
- **Communities** with public/private join policies, moderation roles, and member management
- **Events** with RSVP, attendees list, event-reminder emails, and a daily cron notification
- **Marketplace** for user listings with image uploads
- **Notifications** (in-app and email digest via Resend; Web Push scaffolded, pending UI toggle)
- **Explore** with trigram full-text search across posts, users, and hashtags, plus trending topics
- **Scheduled posts** auto-published daily at 08:00 UTC by a Vercel cron job
- **AI features**: Claude Haiku caption suggestions for image and video posts, LLM-backed content moderation (regex pre-filter with LLM escalation), both gated on `AI_GATEWAY_API_KEY`
- **Settings**: profile, account, privacy (close friends, hidden activity, blocked/muted users), notification preferences, security (MFA, login activity log), creator settings, content filters, streaming preferences
- **Admin panel** at `/admin` for user management, content reports, and platform stats
- **Sentry** observability (opt-in via env vars, no-op when DSN is absent)
- **Rate limiting** at the middleware level: 20 req/min on auth routes, 300 req/min general (in-memory; Redis-backed upgrade path documented in `docs/PHASE_5_SETUP.md`)
- **Security headers** on every response: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Permissions-Policy`, `Referrer-Policy`

## Tech stack

| Layer | Library / Service | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.7 |
| Language | TypeScript | ^5 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | ^4 |
| Component primitives | shadcn/ui (base-nova style) + Base UI | ^4.4.0 / ^1.4.1 |
| Icons | Lucide React | ^1.9.0 |
| Animation | Framer Motion | ^12.38.0 |
| Carousel | Embla Carousel | ^8.6.0 |
| Backend / auth / realtime | Supabase | JS SDK ^2.104.1 |
| Data fetching | TanStack Query | ^5.100.1 |
| Virtual lists | TanStack Virtual | ^3.13.24 |
| State | Zustand | ^5.0.12 |
| Forms | React Hook Form + Zod | ^7.73.1 / ^4.3.6 |
| Video streaming | Mux (Node SDK + Player) | ^14.0.1 / ^3.12.0 |
| AI / LLM | Vercel AI SDK (Claude Haiku) | ^6.0.168 |
| Email | Resend | ^6.12.2 |
| Web Push | web-push | ^3.6.7 |
| Bot protection | Cloudflare Turnstile | @marsidev/react-turnstile ^1.5.0 |
| Observability | Sentry | ^10.50.0 |
| QR codes | qrcode | ^1.5.4 |
| Date utilities | date-fns | ^4.1.0 |
| Deployment | Vercel | |

Node.js 20 or later is required (matches `@types/node ^20`); CI runs on Node 24.

## Quickstart

```bash
# 1. Clone and install
git clone <repo-url> orbit
cd orbit
npm install

# 2. Copy the env template and fill in the required values (see Configuration)
cp .env.example .env.local

# 3. Apply Supabase migrations (requires Supabase CLI linked to your project)
supabase db push

# 4. Start the dev server
npm run dev
# App is available at http://localhost:3000
```

## Installation

Prerequisites: Node.js 20+, npm, a Supabase project, and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
git clone <repo-url> orbit
cd orbit
npm install
```

Copy the environment template:

```bash
cp .env.example .env.local
```

Apply all database migrations to your Supabase project:

```bash
# If your CLI is linked to the remote project
supabase db push

# Or run migrations against a local Supabase stack
supabase start
supabase migration up
```

Start the dev server:

```bash
npm run dev
```

## Configuration

Copy `.env.example` to `.env.local` and fill in the values below. Never commit `.env.local` (it is gitignored). Push the same variables to your Vercel project settings for production.

### Required for the app to run

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-only, never sent to the browser) |
| `NEXT_PUBLIC_APP_URL` | Full URL of your deployment, e.g. `https://yourdomain.com` (used in emails and auth links) |

### Transactional email (Resend)

Required for email delivery (signup confirmation, password reset, event reminders, digest). Without these, emails log to stdout in dev and fail silently in prod.

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key with Sending access scope |
| `RESEND_FROM` | From address, e.g. `Orbit <no-reply@mail.yourdomain.com>` |
| `SUPABASE_AUTH_HOOK_SECRET` | Webhook signing secret from Supabase Dashboard (Authentication > Hooks). Routes auth emails through Resend instead of Supabase's default. |

See `docs/PHASE_1_SETUP.md` for full Resend and Supabase Auth Hook setup steps.

### Cron jobs

| Variable | Description |
|---|---|
| `CRON_SECRET` | Secret used to authenticate Vercel cron calls to `/api/cron/*`. Generate with `openssl rand -hex 32`. |

Five cron routes are registered in `vercel.json` and run only in Vercel Production deployments:

| Route | Schedule (UTC) | Purpose |
|---|---|---|
| `/api/cron/publish-scheduled-posts` | 08:00 daily | Publishes posts whose scheduled time has passed |
| `/api/cron/event-reminders` | 09:00 daily | Emails attendees of upcoming events |
| `/api/cron/cleanup-stories` | 04:00 daily | Deletes expired stories |
| `/api/cron/cleanup-login-activity` | 03:00 daily | Prunes old login activity records |
| `/api/cron/notification-digest` | 10:00 daily | Sends daily notification digest emails |

### Live streaming (Mux)

Required for the `/live` routes to create streams and serve playback.

| Variable | Description |
|---|---|
| `MUX_TOKEN_ID` | Mux access token ID (Video Read+Write) |
| `MUX_TOKEN_SECRET` | Mux access token secret |
| `MUX_WEBHOOK_SECRET` | Signing secret for `/api/mux/webhook` (from Mux dashboard) |

See `docs/PHASE_2_SETUP.md` for full Mux account setup and webhook registration.

### AI features (caption suggestions and content moderation)

When absent, `POST /api/captions/suggest` returns 503 and the composer falls back to local heuristic captions. `POST /api/moderation/check` returns a clean no-op result. No features break.

| Variable | Description |
|---|---|
| `AI_GATEWAY_API_KEY` | API key for the AI gateway used by Vercel AI SDK to call `anthropic/claude-haiku-4-5` |

### Web Push notifications

| Variable | Description |
|---|---|
| `VAPID_PUBLIC_KEY` | VAPID public key (server-side signing) |
| `VAPID_PRIVATE_KEY` | VAPID private key |
| `VAPID_SUBJECT` | Contact URI for VAPID, e.g. `mailto:you@example.com` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Must equal `VAPID_PUBLIC_KEY` (client uses this to subscribe) |

Generate VAPID keys: `npx web-push generate-vapid-keys`

See `docs/PHASE_5_SETUP.md` for activation steps and the pending UI integration note.

### Observability (Sentry, optional)

Sentry is a no-op at runtime when `NEXT_PUBLIC_SENTRY_DSN` is unset. The `withSentryConfig` build wrapper is also skipped when both DSN and auth token are absent, so local builds are unaffected.

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry project DSN |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source map uploads (project:releases + org:read scopes) |
| `SENTRY_ORG` | Sentry organization slug |
| `SENTRY_PROJECT` | Sentry project slug |

See `docs/PHASE_3_1_SETUP.md` for setup and sample-rate defaults.

### TURN relay for P2P calls (optional)

WebRTC calls use Google public STUN by default. TURN is needed for users behind symmetric NAT (roughly 30% of mobile). See `docs/PHASE_4_SETUP.md` for two provider options (Cloudflare Calls or Twilio NTS).

| Variable | Description |
|---|---|
| `TURN_TOKEN_ID` | Cloudflare Calls app token ID (if using Cloudflare) |
| `TURN_TOKEN_SECRET` | Cloudflare Calls app token secret (if using Cloudflare) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID (if using Twilio NTS instead) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token (if using Twilio NTS instead) |

### Distributed rate limiting (optional, Upstash)

The current rate limiter uses an in-memory `Map` (per-function-instance). Replace it with a Redis-backed sliding-window limiter by adding these vars and following `docs/PHASE_5_SETUP.md`.

| Variable | Description |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

## Usage

All scripts are defined in `package.json`.

```bash
# Development server
npm run dev

# Production build
npm run build

# Start the production server (after build)
npm start

# Lint (ESLint 9 with Next.js config)
npm run lint

# Typecheck (tsc --noEmit)
npm run typecheck
```

There are no test scripts in this repository. `npm test` will fail.

### Manually triggering a cron route

Each cron endpoint requires the `Authorization: Bearer <CRON_SECRET>` header. Without it the route returns 401.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://yourdomain.com/api/cron/publish-scheduled-posts
```

## Project structure

```
orbit/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login, signup, onboarding, password reset, verify-email
│   │   ├── (main)/          # Authenticated app shell (sidebar, bottom nav, realtime bridge)
│   │   │   ├── feed/        # Ranked home feed
│   │   │   ├── clips/       # Short vertical video feed
│   │   │   ├── messages/    # DMs and group chats
│   │   │   ├── notifications/
│   │   │   ├── explore/     # Search, trending, user suggestions
│   │   │   ├── communities/ # Community pages and detail
│   │   │   ├── events/      # Event pages and RSVP
│   │   │   ├── live/        # Live stream pages
│   │   │   ├── vod/         # Recorded stream playback
│   │   │   ├── marketplace/ # Listings
│   │   │   ├── bookmarks/
│   │   │   ├── drafts/
│   │   │   ├── scheduled/
│   │   │   └── settings/    # Profile, account, privacy, security, notifications, creator, streaming
│   │   ├── [username]/      # Public profile pages
│   │   ├── post/[postId]/   # Post detail
│   │   ├── hashtag/[tag]/   # Hashtag feed
│   │   ├── location/[place]/# Location-tagged post feed
│   │   ├── admin/           # Admin panel (users, reports, stats)
│   │   └── api/             # Route handlers
│   │       ├── auth/        # Email hook, resend verification
│   │       ├── captions/    # AI caption suggestions
│   │       ├── cron/        # Scheduled jobs
│   │       ├── live/        # Stream management, chat
│   │       ├── moderation/  # LLM content moderation
│   │       ├── mux/         # Webhook receiver, VOD refresh
│   │       └── push/        # Web Push subscribe and test
│   ├── components/
│   │   ├── orbit/           # Design-system primitives (badges, forms, indicators)
│   │   ├── ui/              # shadcn/ui components
│   │   ├── feed/            # Post card, composer, reactions, magazine layout
│   │   ├── clips/           # Clip player, creator, actions
│   │   ├── messages/        # Chat window, voice recorder, call overlay
│   │   ├── live/            # Stream card, gift picker, category/language pickers
│   │   ├── stories/         # Story bar, viewer, creator
│   │   ├── communities/     # Community card, member management dialogs
│   │   ├── events/          # Event card, attendees, create dialog
│   │   ├── marketplace/     # Listing card, create dialog
│   │   ├── profile/         # Profile header, grid, follow list, QR code
│   │   ├── notifications/   # Bell, notification item
│   │   ├── explore/         # Search results, trending tags, user suggestions
│   │   ├── layout/          # Sidebar, bottom nav, top bar, realtime bridge
│   │   ├── admin/           # Report item, stats card
│   │   └── shared/          # Follow button, avatar, report dialog, image cropper
│   ├── lib/
│   │   ├── hooks/           # use-auth, use-feed, use-messages, use-webrtc, use-push-subscribe, etc.
│   │   ├── queries/         # Supabase query functions per domain
│   │   ├── services/        # Email, Mux, Web Push, feed algorithm, moderation, captions, smart replies
│   │   ├── stores/          # Zustand stores (drafts, filter, ui)
│   │   ├── supabase/        # Browser client, server client, admin client, middleware helper
│   │   ├── utils/           # Constants, formatters, validators, timezone, audio
│   │   └── design/          # Orbit design tokens (orbit.ts)
│   ├── providers/           # TanStack Query + Tooltip provider wrapper
│   ├── instrumentation.ts   # Sentry server/edge init
│   └── instrumentation-client.ts  # Sentry browser init
├── supabase/
│   └── migrations/          # 60+ sequential SQL migrations (auth, posts, social graph,
│                            #   messaging, stories, notifications, communities, marketplace,
│                            #   events, moderation, live streaming, reactions, scheduled posts,
│                            #   security features, push subscriptions, privacy, and more)
├── public/
│   └── sw.js                # Service worker for Web Push
├── docs/
│   ├── PHASE_1_SETUP.md     # Resend email + cron secret + Supabase Auth Hook setup
│   ├── PHASE_2_SETUP.md     # Mux live streaming setup
│   ├── PHASE_3_1_SETUP.md   # Sentry observability setup
│   ├── PHASE_4_SETUP.md     # TURN relay setup for WebRTC calls
│   └── PHASE_5_SETUP.md     # Upstash Redis rate limiting + Web Push activation
├── middleware.ts            # Session refresh, auth-required route guard, rate limiting
├── next.config.ts           # Image CDN patterns, security headers, Sentry wrapper
├── vercel.json              # Cron job schedules
└── components.json          # shadcn/ui configuration (base-nova style, neutral base)
```

## Database

Migrations live in `supabase/migrations/` and are applied in order with `supabase db push` (remote) or `supabase migration up` (local). There are currently 60+ migrations covering:

- User profiles and auth (`00001`)
- Posts, media, reactions, boosts, scheduled posts (`00002`, `00012`, `00013`)
- Social graph (follows, blocks, mutes, close friends) (`00003`, `00029`, `00050`)
- Direct messages and group chats with realtime (`00004`, `00015`)
- Stories (`00005`)
- Notifications, triggers, and preferences (`00006`, `00017`, `00018`, `20260501010000`)
- Communities (`00007`)
- Marketplace (`00008`)
- Events (`00009`)
- Content moderation and flags (`00010`)
- Live streaming and VODs (`00011`, `20260426*`)
- Security features: MFA recovery codes, login activity, privacy enforcement (`20260424*`, `20260501*`)
- Push subscriptions (`20260426163616`)
- Search trigram indexes (`20260425234605`)
- Post mentions (`20260429060000`)

## Deployment

The app deploys to Vercel. On every push to `main`, Vercel builds and deploys automatically.

```bash
# One-time: link the Vercel project
vercel link

# Manual production deploy
vercel deploy --prod --yes
```

Push all required env vars to Vercel before the first production deploy. Cron jobs in `vercel.json` only activate in Production deployments. After the first deploy, verify they appear at: Vercel Dashboard > Project > Settings > Cron Jobs.

For a full production checklist covering email, live streaming, AI, push notifications, and observability setup, work through the docs in order: `docs/PHASE_1_SETUP.md` through `docs/PHASE_5_SETUP.md`.

## Contributing

1. Branch off `main` for every change.
2. Run `npm run build` and `npm run lint` before opening a PR. Both must be clean.
3. There is no automated test suite. Verify changes manually against a development Supabase project.
4. Keep migrations reversible and backward-compatible where possible; call out any destructive migration in the PR description.
5. Do not commit `.env.local` or any file containing real credentials. The `.gitignore` blocks all `.env*` variants (except `.env.example`).

## License

No license file is present in this repository.
