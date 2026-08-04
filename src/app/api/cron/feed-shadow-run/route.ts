/**
 * Vercel Cron: daily at 05:30.
 *
 * Records what the For You ranker WOULD have shown each viewer next to what
 * the chronological feed actually shows, so the ranker can be judged before
 * anyone is switched onto it. Writes one feed_shadow_runs row per viewer.
 *
 * `feed_for_you` is SECURITY INVOKER and reads auth.uid(), so it can only be
 * evaluated from a viewer's own session. The service role has no uid, which
 * is why each viewer gets a short-lived signed token here; the token is
 * read-only by construction (RLS still applies to it) and never leaves this
 * process. Rows go in through the service-role client because
 * feed_shadow_runs has RLS on with no client policies.
 */
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCronAuthorized } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Bounded so one run cannot walk the whole user table.
const MAX_VIEWERS = 200;
const SHADOW_PAGE_SIZE = 20;
const VIEWER_TOKEN_TTL_SECONDS = 120;

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signViewerToken(userId: string, secret: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const claims = base64url({
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    iat: issuedAt,
    exp: issuedAt + VIEWER_TOKEN_TTL_SECONDS,
  });
  const signingInput = `${base64url({ alg: "HS256", typ: "JWT" })}.${claims}`;
  const signature = createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64url");
  return `${signingInput}.${signature}`;
}

function viewerClient(userId: string, secret: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${signViewerToken(userId, secret)}`,
        },
      },
    }
  );
}

export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    return NextResponse.json(
      { error: "SUPABASE_JWT_SECRET not configured on server" },
      { status: 503 }
    );
  }

  const admin = createAdminClient();
  const { data: viewers, error: viewersError } = await admin
    .from("profiles")
    .select("id")
    .is("deactivated_at", null)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(MAX_VIEWERS);

  if (viewersError) {
    return NextResponse.json({ error: viewersError.message }, { status: 500 });
  }

  let recorded = 0;
  let skipped = 0;

  // Sequential on purpose: this is a background comparison, not a user
  // request, and a fan-out over 200 viewers would spike the database.
  for (const viewer of viewers ?? []) {
    const viewerId = viewer.id as string;
    const scoped = viewerClient(viewerId, jwtSecret);

    const { data: rankedRows, error: rankedError } = await scoped.rpc(
      "feed_for_you",
      { p_limit: SHADOW_PAGE_SIZE, p_exclude: [] }
    );
    if (rankedError || !rankedRows || rankedRows.length === 0) {
      skipped++;
      continue;
    }
    const rankedIds = (rankedRows as { post_id: string }[]).map(
      (row) => row.post_id
    );

    // Same filters as the chronological For You query in
    // src/lib/queries/posts.ts getFeedPosts, ids only.
    const { data: chronoRows, error: chronoError } = await scoped
      .from("posts")
      .select("id")
      .is("reply_to_id", null)
      .is("community_id", null)
      .eq("is_hidden", false)
      .not("type", "eq", "reel")
      .order("created_at", { ascending: false })
      .limit(SHADOW_PAGE_SIZE);
    if (chronoError) {
      skipped++;
      continue;
    }
    const chronoIds = (chronoRows ?? []).map((row) => row.id as string);

    const { data: authorRows } = await admin
      .from("posts")
      .select("id, user_id")
      .in("id", rankedIds);
    const authorIds = [
      ...new Set((authorRows ?? []).map((row) => row.user_id as string)),
    ];

    const { data: followRows } = await admin
      .from("follows")
      .select("following_id")
      .eq("follower_id", viewerId)
      .in("following_id", authorIds);
    const followed = new Set(
      (followRows ?? []).map((row) => row.following_id as string)
    );

    const chronoSet = new Set(chronoIds);
    const overlapCount = rankedIds.filter((id) => chronoSet.has(id)).length;
    const outOfNetwork = (authorRows ?? []).filter(
      (row) => !followed.has(row.user_id as string)
    ).length;

    const { error: insertError } = await admin.from("feed_shadow_runs").insert({
      viewer_id: viewerId,
      ranked_ids: rankedIds,
      chrono_ids: chronoIds,
      overlap_count: overlapCount,
      out_of_network: outOfNetwork,
    });
    if (insertError) {
      skipped++;
      continue;
    }
    recorded++;
  }

  return NextResponse.json({ ok: true, recorded, skipped });
}
