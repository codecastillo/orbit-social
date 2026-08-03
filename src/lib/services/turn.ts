/**
 * Short-lived TURN credentials for the WebRTC calls in DMs.
 *
 * Cloudflare Realtime (formerly Calls) mints the credentials server-side from a
 * TURN key, so the key secret never reaches the browser. Setup steps and the
 * relay verification procedure live in docs/PHASE_4_SETUP.md.
 */

const CLOUDFLARE_TURN_API = "https://rtc.live.cloudflare.com/v1/turn/keys";

// Long enough to outlive any call that is already ringing when the page loads,
// short enough that a leaked credential expires the same day.
const CREDENTIAL_TTL_SECONDS = 4 * 60 * 60;

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface TurnKey {
  id: string;
  secret: string;
}

function getTurnKey(): TurnKey {
  const id = process.env.TURN_TOKEN_ID;
  const secret = process.env.TURN_TOKEN_SECRET;
  if (!id || !secret) {
    throw new Error("TURN_TOKEN_ID and TURN_TOKEN_SECRET must be set");
  }
  return { id, secret };
}

export function hasTurnCredentials(): boolean {
  return Boolean(process.env.TURN_TOKEN_ID && process.env.TURN_TOKEN_SECRET);
}

/**
 * Asks Cloudflare for a credential pair scoped to CREDENTIAL_TTL_SECONDS.
 * Returns the STUN and TURN entries Cloudflare hands back, ready to drop into
 * an RTCConfiguration. Throws when the key is unset or Cloudflare rejects it,
 * so the caller decides whether to degrade to STUN-only.
 */
export async function getTurnCredentials(): Promise<IceServer[]> {
  const key = getTurnKey();

  const response = await fetch(
    `${CLOUDFLARE_TURN_API}/${key.id}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: CREDENTIAL_TTL_SECONDS }),
    },
  );

  if (!response.ok) {
    throw new Error(`Cloudflare TURN credential request failed: ${response.status}`);
  }

  const body = (await response.json()) as { iceServers?: IceServer | IceServer[] };
  if (!body.iceServers) {
    throw new Error("Cloudflare TURN response contained no iceServers");
  }

  return Array.isArray(body.iceServers) ? body.iceServers : [body.iceServers];
}
