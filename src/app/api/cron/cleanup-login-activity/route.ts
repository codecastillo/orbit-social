/**
 * Vercel Cron: daily at 03:00 UTC.
 * Trims login_events older than 90 days so the table doesn't grow unbounded.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCronAuthorized } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("login_events")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
