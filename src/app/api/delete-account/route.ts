import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient();

  // Get the authenticated user
  let userId: string | null = null;

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    userId = user.id;
  } else {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      userId = session.user.id;
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  try {
    // Delete profile first — this cascades to all user content
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
