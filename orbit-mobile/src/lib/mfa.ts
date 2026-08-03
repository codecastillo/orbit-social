import { supabase } from "@/lib/supabase";

export interface MfaState {
  /** Verified TOTP factor id, or null when the account has no second factor. */
  factorId: string | null;
  /** True when the password step passed but the TOTP code is still owed. */
  challengePending: boolean;
}

/**
 * Resolves whether the current session still owes a TOTP challenge, from
 * sources the client cannot forge.
 *
 * Web decides this in middleware from `user.factors` off a getUser() response
 * plus the `aal` claim of the access token getUser() just validated. Mobile
 * never traverses that middleware, so it makes the same two checks here:
 * mfa.listFactors() reads the factor list out of a getUser() call, and
 * getClaims() either verifies the token signature or falls back to getUser()
 * before handing back the claims. mfa.getAuthenticatorAssuranceLevel() is
 * deliberately unused, it reports the level from locally stored session data.
 */
export async function getMfaState(): Promise<MfaState> {
  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;

  const factorId =
    factors.totp.find((factor) => factor.status === "verified")?.id ?? null;
  if (!factorId) return { factorId: null, challengePending: false };

  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) throw claimsError;

  return { factorId, challengePending: data?.claims.aal !== "aal2" };
}
