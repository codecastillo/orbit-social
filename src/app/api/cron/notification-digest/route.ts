/**
 * Vercel Cron: daily at 09:00 UTC.
 * For every user with unread notifications who has the digest turned on,
 * batch into a single Resend email carrying a one-click unsubscribe link.
 *
 * This is a best-effort fan-out, we cap at MAX_USERS_PER_RUN per run
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
// Opt-outs are resolved across a wider window than the send cap so
// unsubscribed users don't consume the per-run budget, while the IN list
// stays bounded.
const CANDIDATE_WINDOW = MAX_USERS_PER_RUN * 2;

type CountRow = { user_id: string; type: string; n: number };

export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const supabase = createAdminClient();
  const sinceIso = new Date(Date.now() - SINCE_HOURS * 60 * 60 * 1000).toISOString();

  // 1. Pull unread notifications from the last day, grouped by user + type (in app code, Supabase
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

  const candidateIds = [...buckets.keys()].slice(0, CANDIDATE_WINDOW);

  // 2. Drop anyone who turned the digest off. Only an explicit false counts,
  // so users with no preferences row keep the default opt-in.
  const { data: optOutRows, error: prefsError } = await supabase
    .from("notification_preferences")
    .select("user_id")
    .in("user_id", candidateIds)
    .eq("email_digest", false);

  if (prefsError) {
    return NextResponse.json({ error: prefsError.message }, { status: 500 });
  }

  const optedOut = new Set((optOutRows ?? []).map((r) => r.user_id as string));
  const userIds = candidateIds
    .filter((id) => !optedOut.has(id))
    .slice(0, MAX_USERS_PER_RUN);

  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: optedOut.size });
  }

  // 3. Fetch emails + display names + the per-user unsubscribe token.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username, email_unsubscribe_token")
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
    // Bulk mail without a working opt-out link is not something to send at
    // all, so a missing token skips the user rather than degrading the email.
    if (!profile?.email_unsubscribe_token) continue;
    const counts = buckets.get(userId) ?? {};
    const result = await Email.digestDaily(email, {
      name: profile.display_name || profile.username || "there",
      unsubscribeToken: profile.email_unsubscribe_token as string,
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

  return NextResponse.json({
    ok: true,
    sent,
    queued: userIds.length,
    skipped: optedOut.size,
  });
}
