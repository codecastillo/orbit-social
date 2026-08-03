/**
 * Hands the call UI its ICE configuration. TURN credentials are minted here so
 * the Cloudflare key stays server-side, and relay traffic is billable, so the
 * route is authenticated and rate limited. With no TURN key configured it
 * returns the public STUN list and calls behave exactly as they did before.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getTurnCredentials, hasTurnCredentials, type IceServer } from "@/lib/services/turn";

const noStore = { "Cache-Control": "no-store, max-age=0" };

const ICE_WINDOW_MS = 5 * 60 * 1000;
const ICE_REQUESTS_PER_WINDOW = 10;

const STUN_SERVERS: IceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  const { success } = rateLimit(
    `ice-servers:${user.id}`,
    ICE_REQUESTS_PER_WINDOW,
    ICE_WINDOW_MS,
  );
  if (!success) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: noStore },
    );
  }

  if (!hasTurnCredentials()) {
    return NextResponse.json({ iceServers: STUN_SERVERS }, { headers: noStore });
  }

  try {
    const turn = await getTurnCredentials();
    return NextResponse.json(
      { iceServers: [...STUN_SERVERS, ...turn] },
      { headers: noStore },
    );
  } catch (e) {
    // A TURN outage must not take calls down with it: STUN-only still connects
    // for most peers.
    console.error("TURN credential mint failed", e);
    return NextResponse.json({ iceServers: STUN_SERVERS }, { headers: noStore });
  }
}
