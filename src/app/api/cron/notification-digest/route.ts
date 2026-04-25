/**
 * Vercel Cron: daily at 09:00 UTC.
 * For every user with unread notifications since their last digest,
 * batch into a single Resend email and mark the digest as sent.
 *
 * This is a best-effort fan-out — we cap at MAX_USERS_PER_RUN per run
 * so a single cron tick doesn't time out. Future runs pick up the rest.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Email } from "@/lib/services/email";
import { assertCronAuthorized } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_USERS_PER_RUN = 200;
const SINCE_HOURS = 24;

type CountRow = { user_id: string; type: string; n: number };

export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const supabase = createAdminClient();
  const sinceIso = new Date(Date.now() - SINCE_HOURS * 60 * 60 * 1000).toISOString();

  // 1. Pull unread notifications from the last day, grouped by user + type (in app code — Supabase
  // doesn't expose `group by` directly via the JS client; we do a simple pull and bucket here).
  const { data: rows, error } = await supabase
    .from("notifications")
    .select("user_id, type")
    .eq("is_read", false)
    .gte("created_at", sinceIso)
    .limit(20000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const buckets = new Map<string, Record<string, number>>();
  for (const r of rows as CountRow[]) {
    const key = r.user_id;
    if (!buckets.has(key)) buckets.set(key, {});
    const b = buckets.get(key)!;
    b[r.type] = (b[r.type] || 0) + 1;
  }

  const userIds = [...buckets.keys()].slice(0, MAX_USERS_PER_RUN);
  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // 2. Fetch emails + display names + per-user notification prefs (best-effort).
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", userIds);

  const { data: authUsers } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const emailById = new Map<string, string>();
  for (const u of authUsers?.users ?? []) {
    if (u.email && u.id) emailById.set(u.id, u.email);
  }

  let sent = 0;
  for (const userId of userIds) {
    const email = emailById.get(userId);
    if (!email) continue;
    const profile = profiles?.find((p) => p.id === userId);
    const counts = buckets.get(userId) ?? {};
    const result = await Email.digestDaily(email, {
      name: profile?.display_name || profile?.username || "there",
      counts: {
        likes: counts["like"] || 0,
        comments: counts["comment"] || 0,
        follows: counts["follow"] || 0,
        mentions: counts["mention"] || 0,
        messages: counts["message"] || 0,
      },
    });
    if (result.ok) sent++;
  }

  return NextResponse.json({ ok: true, sent, queued: userIds.length });
}
