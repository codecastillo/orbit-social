/**
 * RFC 8058 one-click unsubscribe target for the daily digest.
 *
 * Mailbox providers POST here straight from the Unsubscribe button in the
 * message list, with no session and no chance to render a confirmation page,
 * so this must succeed on the POST alone. The human-facing page at
 * /unsubscribe handles the same token when someone clicks the link in the
 * body of the email.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("unsubscribe_by_token", {
    p_token: token,
  });

  if (error) {
    return NextResponse.json({ error: "Unsubscribe failed" }, { status: 500 });
  }

  // An unknown token is reported as done: the sender's intent is satisfied
  // either way, and a distinct 404 would confirm which tokens are real.
  return NextResponse.json({ ok: true, changed: data === true });
}
