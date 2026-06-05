import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_REDIRECTS = ["/onboarding", "/feed", "/profile", "/settings"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/onboarding";

  // Prevent open redirect: only allow whitelisted internal paths
  const next = ALLOWED_REDIRECTS.includes(rawNext) ? rawNext : "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Record the login so it appears in /settings/security/activity.
        // Server-side: no navigator UA, no clipboard for IP. Pull from request.
        const ua = request.headers.get("user-agent");
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          null;
        try {
          const { error: loginEventError } = await supabase
            .from("login_events")
            .insert({
              user_id: user.id,
              ip_address: ip,
              user_agent: ua,
              status: "success",
            });
          if (loginEventError) {
            console.error("[oauth-callback] login_events insert failed", loginEventError);
          }
        } catch (err) {
          console.error("[oauth-callback] login_events insert threw", err);
        }
        try {
          await supabase.rpc("touch_last_seen");
        } catch {}

        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single();

        if (profile?.username) {
          return NextResponse.redirect(`${origin}/feed`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
