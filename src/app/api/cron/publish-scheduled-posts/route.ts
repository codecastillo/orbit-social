/**
 * Vercel Cron: daily at 08:00 UTC (Hobby plan caps crons at once per day;
 * see vercel.json). Posts scheduled mid-day publish on the next run.
 * Publishes any scheduled posts whose `scheduled_at` is now in the past.
 * Backed by SQL function `publish_due_scheduled_posts()` (00017).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCronAuthorized } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("publish_due_scheduled_posts");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, published: data ?? 0 });
}
