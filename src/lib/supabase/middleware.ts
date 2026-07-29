import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { tokenAal } from "@/lib/supabase/aal";

// Auth-only public routes: unauthenticated users can hit them, authenticated
// users get bounced to /feed.
const publicAuthRoutes = [
  "/login",
  "/signup",
  "/callback",
  "/verify-email",
  "/forgot-password",
];

// Reachable with or without a session, and exempt from the MFA gate:
// /auth/confirm must run verifyOtp for users who already hold a session
// (email change, recovery), and /reset-password is where a recovery-link
// session lands. Neither is bounced like the auth routes above nor gated
// like authRequiredRoutes.
const sessionNeutralRoutes = ["/reset-password", "/auth"];

// Routes that REQUIRE a signed-in user. Anon visitors hitting any of these get
// bounced to /login?next=<pathname>. Everything else (feed, clips, profiles,
// rooms, events, livestreams, post detail, hashtags, VODs) is browseable
// read-only, write actions are guarded at the UI layer via useRequireAuth.
const authRequiredRoutes = [
  "/notifications",
  "/messages",
  "/bookmarks",
  "/drafts",
  "/scheduled",
  "/settings",
  "/onboarding",
];

const AUTH_RATE_LIMIT = 20;
const AUTH_WINDOW_MS = 60_000;
const GENERAL_RATE_LIMIT = 300;
const GENERAL_WINDOW_MS = 60_000;

export async function updateSession(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = publicAuthRoutes.some((route) =>
    pathname.startsWith(route),
  );
  const isSessionNeutralRoute = sessionNeutralRoutes.some((route) =>
    pathname.startsWith(route),
  );
  const isAuthRequiredRoute = authRequiredRoutes.some((route) =>
    pathname.startsWith(route),
  );

  const useAuthLimit = isAuthRoute || isSessionNeutralRoute;
  const { success } = rateLimit(
    `${ip}:${useAuthLimit ? "auth" : "general"}`,
    useAuthLimit ? AUTH_RATE_LIMIT : GENERAL_RATE_LIMIT,
    useAuthLimit ? AUTH_WINDOW_MS : GENERAL_WINDOW_MS,
  );

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
            }),
          );
        },
      },
    },
  );

  // getUser() validates the token against the auth server; getSession() only
  // decodes the cookie, which a client can forge. Redirect decisions below
  // must rely on the verified user.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A session stuck at aal1 while a verified TOTP factor demands aal2 means
  // the password step succeeded but the TOTP step did not. Treat it as
  // signed-out everywhere except /login, where the MFA screen lives, so the
  // second factor cannot be skipped by navigating directly to a URL.
  //
  // Both inputs are server-verified: `user.factors` comes from the getUser()
  // response above, and the aal claim is decoded from the same access token
  // getUser() just validated. The client library's own
  // getAuthenticatorAssuranceLevel() reads factors out of the cookie, which
  // the client controls, so it must not be trusted here.
  if (user && !isSessionNeutralRoute) {
    const hasVerifiedFactor = (user.factors ?? []).some(
      (f) => f.status === "verified",
    );
    if (hasVerifiedFactor) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (tokenAal(session?.access_token) !== "aal2") {
        if (pathname === "/login") {
          return supabaseResponse;
        }
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = "";
        url.searchParams.set("mfa", "1");
        if (isAuthRequiredRoute) url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
    }
  }

  // Anon hitting an auth-required route: bounce to login, preserving deep link.
  if (!user && isAuthRequiredRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Signed-in user hitting login/signup/etc, push them to /feed.
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    return NextResponse.redirect(url);
  }

  // Signed-in user landing on the marketing page, push them to /feed.
  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
