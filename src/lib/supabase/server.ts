import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Native clients send a Supabase access token instead of cookies. The
// Authorization header rides along on every PostgREST request so RLS sees
// the caller; resolve the user by passing the raw token to
// supabase.auth.getUser(token), which validates it against the auth server.
export function createBearerClient(authorization: string) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: authorization } },
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component where
            // cookies cannot be set. This can be ignored if middleware
            // refreshes user sessions.
          }
        },
      },
    }
  );
}
