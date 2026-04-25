/**
 * Vercel Cron: every 5 minutes.
 * Inserts `event_reminder` notifications for events starting within the next
 * 15 minutes, idempotent via the event_reminders_sent table.
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
  const { data, error } = await supabase.rpc("notify_due_event_reminders");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, queued: data ?? 0 });
}
