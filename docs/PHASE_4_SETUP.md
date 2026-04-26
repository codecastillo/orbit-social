# Phase 4 — TURN server for real WebRTC video/voice calls

Currently `src/lib/hooks/use-webrtc.ts:20-24` configures only Google's public STUN servers. STUN-only WebRTC fails for ~30% of mobile users behind symmetric NAT — the call connects but no audio/video flows. TURN relays the media when direct P2P is impossible.

Two free providers; pick one.

## Option A — Cloudflare Calls TURN (recommended)

Free, generous quota (1k GB/mo), Cloudflare runs the TURN servers globally.

1. Cloudflare Dashboard → **Calls** → click **Create app** → name `orbit-turn` → **Save**.
2. The app's detail page shows a **Token ID** and **Token Secret**. Copy both.
3. Push to Vercel:
   ```sh
   echo "<token-id>"     | vercel env add TURN_TOKEN_ID     production --force
   echo "<token-secret>" | vercel env add TURN_TOKEN_SECRET production --force
   ```

## Option B — Twilio Network Traversal Service

Pay-as-you-go ($0.40/GB after free trial). Use only if Cloudflare Calls is geographically poor in your target region.

1. Twilio Console → **Network Traversal Service → Tokens** → use account SID + Auth Token from Console root.
2. Push:
   ```sh
   echo "<account-sid>"  | vercel env add TWILIO_ACCOUNT_SID  production --force
   echo "<auth-token>"   | vercel env add TWILIO_AUTH_TOKEN   production --force
   ```

## Code that gets added (after env is in, ask Claude to ship Phase 4)

- New `GET /api/webrtc/ice-servers` route — server-mints **short-lived TURN credentials** (HMAC-signed for Cloudflare; minted via the Twilio NTS API for Twilio). Never returns the secret to the browser.
- `src/lib/hooks/use-webrtc.ts` — fetches ICE servers from that route at call setup instead of using the hardcoded STUN list.

## Verification

1. Open `chrome://webrtc-internals` in two browsers on different physical networks (e.g. one on home Wi-Fi, one on cellular hotspot).
2. Start a call between them.
3. In webrtc-internals → expand the active connection → look at **selected candidate pair** → at least one side should show `relay` (not `host` or `srflx`). That confirms TURN is being used.
4. Force the worst case with `iceTransportPolicy: "relay"` in the ICE config — call should still connect (relay-only mode). If it fails, TURN credentials are wrong.
