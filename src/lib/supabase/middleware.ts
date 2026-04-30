import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

// Auth-only public routes — unauthenticated users can hit them, authenticated
// users get bounced to /feed.
const publicAuthRoutes = [
  "/login",
  "/signup",
  "/callback",
  "/auth",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];

// Routes that REQUIRE a signed-in user. Anon visitors hitting any of these get
// bounced to /login?next=<pathname>. Everything else (feed, clips, profiles,
// rooms, events, livestreams, post detail, hashtags, VODs) is browseable
// read-only — write actions are guarded at the UI layer via useRequireAuth.
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
  const isAuthRequiredRoute = authRequiredRoutes.some((route) =>
    pathname.startsWith(route),
  );

  const { success } = rateLimit(
    `${ip}:${isAuthRoute ? "auth" : "general"}`,
    isAuthRoute ? AUTH_RATE_LIMIT : GENERAL_RATE_LIMIT,
    isAuthRoute ? AUTH_WINDOW_MS : GENERAL_WINDOW_MS,
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

  let user = null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    user = session.user;
  } else {
    const { data: { user: confirmedUser } } = await supabase.auth.getUser();
    user = confirmedUser;
  }

  // Anon hitting an auth-required route: bounce to login, preserving deep link.
  if (!user && isAuthRequiredRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Signed-in user hitting login/signup/etc — push them to /feed.
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    return NextResponse.redirect(url);
  }

  // Signed-in user landing on the marketing page — push them to /feed.
  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
