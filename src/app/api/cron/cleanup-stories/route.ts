/**
 * Vercel Cron: daily at 04:00.
 *
 * Expiry and deletion are two different things. Passing expires_at hides a
 * moment from viewers (enforced by RLS); the row itself sticks around so the
 * author's archive still has it. Deletion is retention, and only happens
 * MOMENT_RETENTION_DAYS after expiry. Deleting at expiry silently emptied
 * every archive, so keep this window in step with the pg_cron job that
 * sweeps the same table hourly.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCronAuthorized } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOMENT_RETENTION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const cutoff = new Date(Date.now() - MOMENT_RETENTION_DAYS * MS_PER_DAY);
  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("stories")
    .delete({ count: "exact" })
    .lt("expires_at", cutoff.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
