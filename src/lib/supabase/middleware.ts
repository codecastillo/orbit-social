import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const publicRoutes = [
  "/login",
  "/signup",
  "/callback",
  "/auth",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];

// Rate limit: 100 requests per minute per IP for auth routes
const AUTH_RATE_LIMIT = 20;
const AUTH_WINDOW_MS = 60_000;

// Rate limit: 300 requests per minute per IP for general routes
const GENERAL_RATE_LIMIT = 300;
const GENERAL_WINDOW_MS = 60_000;

export async function updateSession(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Apply stricter rate limiting to auth routes
  const { success } = rateLimit(
    `${ip}:${isAuthRoute ? "auth" : "general"}`,
    isAuthRoute ? AUTH_RATE_LIMIT : GENERAL_RATE_LIMIT,
    isAuthRoute ? AUTH_WINDOW_MS : GENERAL_WINDOW_MS
  );

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
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
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
            })
          );
        },
      },
    }
  );

  // Use getSession for unconfirmed users, fall back to getUser
  let user = null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    user = session.user;
  } else {
    const { data: { user: confirmedUser } } = await supabase.auth.getUser();
    user = confirmedUser;
  }

  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Redirect unauthenticated users to login (except public routes and landing)
  if (!user && !isPublicRoute && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    return NextResponse.redirect(url);
  }

  // Redirect root to feed for authenticated users
  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
