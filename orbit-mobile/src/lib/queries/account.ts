import { supabase } from "@/lib/supabase";

// Same web origin the highlights and unfurl calls use. Deletion runs through
// the web API because removing the auth user needs the service role, which
// never ships in the app; the route re-verifies the session server-side and
// demands aal2 from MFA-enrolled accounts.
const ACCOUNT_API_BASE = "https://orbitsocial.net";

/**
 * Pauses the account: the profile and its posts drop out of everyone else's
 * view until the next sign-in clears the flag. Nothing is deleted.
 */
export async function deactivateAccount(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ deactivated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Undoes a pause when a session is established. Filtering on the flag inside
 * the update keeps this to one round trip and makes the returned row the
 * answer to "was this account actually paused", which is what decides whether
 * the user is told anything.
 */
export async function reactivateAccount(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ deactivated_at: null })
    .eq("id", userId)
    .not("deactivated_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * Deletes the signed-in account for good. Throws with the route's own
 * message so the screen can tell an MFA-stale session apart from a real
 * server failure.
 */
export async function deleteAccount(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch(`${ACCOUNT_API_BASE}/api/delete-account`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(error ?? `Account deletion failed (${res.status})`);
  }
}
