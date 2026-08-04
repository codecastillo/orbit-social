import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMfaVerifiedUser } from "@/lib/supabase/verified-user";

export async function POST(request: Request) {
  // Server-verified user, and full aal2 for MFA-enrolled accounts: a
  // password-only session must not be able to destroy the account. The
  // request is passed so the native app can authenticate with its session
  // Bearer token instead of cookies.
  const user = await getMfaVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = user.id;

  const admin = createAdminClient();

  try {
    // Delete profile first: this cascades to all user content
    // (posts, likes, follows, messages, etc. via ON DELETE CASCADE)
    const { error: profileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error("Profile delete error:", profileError);
      return NextResponse.json({ error: "Database error deleting user data" }, { status: 500 });
    }

    // Now delete the auth user
    const { error: authError } = await admin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error("Auth delete error:", authError);
      return NextResponse.json({ error: "Failed to delete auth account" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete account error:", err);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
