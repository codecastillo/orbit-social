import type { User } from "@supabase/supabase-js";
import { createClient } from "./server";
import { tokenAal } from "./aal";

/**
 * Resolves the request's server-verified user and, for MFA-enrolled
 * accounts, requires the session to have completed the second factor.
 * API routes sit outside the middleware matcher, so destructive ones must
 * run this themselves instead of a bare getUser(). Returns null for
 * anonymous requests and for sessions still stuck at aal1.
 */
export async function getMfaVerifiedUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const hasVerifiedFactor = (user.factors ?? []).some(
    (f) => f.status === "verified",
  );
  if (!hasVerifiedFactor) return user;

  const { data: { session } } = await supabase.auth.getSession();
  return tokenAal(session?.access_token) === "aal2" ? user : null;
}
