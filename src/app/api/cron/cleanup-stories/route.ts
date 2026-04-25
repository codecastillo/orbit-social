/**
 * Vercel Cron: hourly at :15.
 * Deletes stories whose expires_at is in the past.
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
  const { error, count } = await supabase
    .from("stories")
    .delete({ count: "exact" })
    .lt("expires_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
