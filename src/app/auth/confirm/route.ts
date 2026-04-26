import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_NEXT = ["/onboarding", "/feed", "/profile", "/settings", "/reset-password"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next") ?? "/feed";
  const next = ALLOWED_NEXT.includes(rawNext) ? rawNext : "/feed";

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=verification_failed&detail=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
