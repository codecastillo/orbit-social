import { supabase } from "@/lib/supabase";

// Same web origin the highlights and unfurl calls use. Deletion runs through
// the web API because removing the auth user needs the service role, which
// never ships in the app; the route re-verifies the session server-side and
// demands aal2 from MFA-enrolled accounts.
const ACCOUNT_API_BASE = "https://orbitsocial.net";

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
