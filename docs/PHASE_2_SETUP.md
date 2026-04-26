# Phase 2 — Live streaming (Mux real ingest + playback)

Code is NOT yet wired. This doc captures everything you need to do as the operator, plus what gets built once the env vars are in. Cross-reference: `src/lib/services/live.ts` already declares the columns `mux_live_stream_id` and `mux_playback_id` on `live_streams`.

## 1. Create a Mux account

1. Sign up at https://mux.com (no credit card on the free dev tier; pay-as-you-go after).
2. **Dashboard → Settings → Access Tokens → Generate new token**.
   - Permissions: **Mux Video — Read + Write**
   - Optional but recommended: **Mux Data — Read** (for analytics later)
   - Note the **Token ID** and **Token Secret**.
3. **Webhooks → Add new endpoint** → URL: `https://orbit-social-codecastillos-projects.vercel.app/api/mux/webhook` → events: `video.live_stream.active`, `video.live_stream.idle`, `video.live_stream.disconnected`. Save → copy the **signing secret**.
4. **Mux Data → Environments** → use the default Production environment → copy the **Env Key** (this is public, used by the player).

## 2. Push 4 env vars to Vercel

```sh
echo "<token-id>"          | vercel env add MUX_TOKEN_ID            production --force
echo "<token-secret>"      | vercel env add MUX_TOKEN_SECRET        production --force
echo "<webhook-signing>"   | vercel env add MUX_WEBHOOK_SECRET      production --force
echo "<env-key>"           | vercel env add NEXT_PUBLIC_MUX_ENV_KEY production --force
```

Mirror to `.env.local` if you want to test ingest from local dev (note: the webhook URL must still be public — use ngrok or a Vercel preview deploy if testing webhooks locally).

## 3. Code that gets added (once env is in, ask Claude to ship Phase 2)

- `npm install @mux/mux-node @mux/mux-player-react`
- `src/lib/services/mux.ts` — `createLiveStream()`, `getLiveStreamStatus()`, helper to construct playback URL
- `POST /api/live/create` — server-mints a Mux live stream, stores `stream_key` (encrypted) + `playback_id` on the row, returns ingest URL + key to streamer
- `POST /api/mux/webhook` — verifies `MUX_WEBHOOK_SECRET`, handles `video.live_stream.active|idle|disconnected`, updates `live_streams.status` + broadcasts to room
- Replace `<video>` placeholder on `/live/[id]` page with `<MuxPlayer playbackId={...}>`

Ephemeral chat (Supabase Broadcast) and virtual gifts already work — no changes there.

## 4. Verification

1. Click **Go Live** in one browser → page shows ingest URL + stream key.
2. Open OBS → Settings → Stream → Service: **Custom**, Server: ingest URL, Stream key: (from previous step).
3. Start streaming in OBS.
4. Open `/live/<id>` in second browser → should see the live feed within ~5 sec.
5. Mux dashboard → Live Streams → verify status flips to **Active** when broadcasting, **Idle** when stopped.
