/**
 * Re-send the email verification link for a given address.
 *
 * Triggered by the "Resend verification" button on /verify-email.
 * Wraps `supabase.auth.resend()` so the client doesn't need to keep the email
 * around in form state and so we can rate-limit at the API boundary.
 *
 * Note: when Supabase Auth Hooks are configured, the actual email is sent by
 * /api/auth/email-hook → Resend. This route only triggers Supabase to re-fire
 * the hook for the same email address.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: string } = {};
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "malformed body" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || ""}/auth/confirm?next=/feed`,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "resend failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
