/**
 * Supabase Auth Hooks endpoint — "Send Email" hook.
 *
 * Configure this URL in the Supabase dashboard:
 *   Authentication → Hooks → Send email hook → HTTP endpoint
 *   URL: https://<your-domain>/api/auth/email-hook
 *   HTTP method: POST
 *   Auth: Use a generated webhook secret stored as SUPABASE_AUTH_HOOK_SECRET
 *
 * On every signup / password recovery / email change, Supabase POSTs the
 * email payload to this route INSTEAD of sending its built-in email.
 * We reformat as an Orbit-branded Resend message.
 *
 * Spec: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
 */
import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { Email } from "@/lib/services/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupabaseEmailPayload = {
  user: {
    id: string;
    email: string;
    user_metadata?: { display_name?: string; full_name?: string; username?: string };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type:
      | "signup"
      | "recovery"
      | "invite"
      | "magiclink"
      | "email_change"
      | "email_change_current"
      | "email_change_new";
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

function buildLink(payload: SupabaseEmailPayload): string {
  const { token_hash, email_action_type, redirect_to, site_url } = payload.email_data;
  const base = process.env.NEXT_PUBLIC_APP_URL || site_url || "";
  const params = new URLSearchParams({
    token_hash,
    type: email_action_type,
    next: redirect_to || "/feed",
  });
  return `${base}/auth/confirm?${params.toString()}`;
}

export async function POST(req: Request) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  const raw = await req.text();

  // If a webhook secret is configured, verify the standard-webhooks signature.
  // Otherwise (dev), fall through and parse without verification but log a warning.
  let payload: SupabaseEmailPayload;
  if (secret) {
    try {
      const wh = new Webhook(secret);
      payload = wh.verify(raw, {
        "webhook-id": req.headers.get("webhook-id") || "",
        "webhook-timestamp": req.headers.get("webhook-timestamp") || "",
        "webhook-signature": req.headers.get("webhook-signature") || "",
      }) as SupabaseEmailPayload;
    } catch (err) {
      return NextResponse.json(
        { error: "invalid signature", detail: err instanceof Error ? err.message : String(err) },
        { status: 401 }
      );
    }
  } else {
    console.warn("[email-hook] SUPABASE_AUTH_HOOK_SECRET unset — accepting payload without verification (dev only)");
    try {
      payload = JSON.parse(raw) as SupabaseEmailPayload;
    } catch {
      return NextResponse.json({ error: "malformed body" }, { status: 400 });
    }
  }

  const { email, user_metadata } = payload.user;
  const action = payload.email_data.email_action_type;
  const link = buildLink(payload);
  const displayName =
    user_metadata?.display_name || user_metadata?.full_name || user_metadata?.username || "there";

  let result;
  switch (action) {
    case "signup":
    case "invite":
    case "email_change":
    case "email_change_new":
      result = await Email.verifyEmail(email, { verifyUrl: link });
      break;
    case "recovery":
      result = await Email.passwordReset(email, { resetUrl: link });
      break;
    case "magiclink":
      // Reuse verify-email shell for magic links (same CTA shape).
      result = await Email.verifyEmail(email, { verifyUrl: link });
      break;
    default:
      // Unknown action — let Supabase fall back to its default by returning success
      // without sending. Alternative: throw so Supabase retries.
      return NextResponse.json({ ok: true, skipped: action });
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  // Best-effort welcome email on first signup (don't block the auth flow).
  if (action === "signup") {
    Email.welcome(email, { name: displayName }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
