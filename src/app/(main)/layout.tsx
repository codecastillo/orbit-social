export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TopBar } from "@/components/layout/top-bar";
import { RealtimeBridge } from "@/components/layout/realtime-bridge";
import { EmailVerificationBanner } from "@/components/shared/email-verification-banner";
import { PostComposer } from "@/components/feed/post-composer";
import { orbitBg } from "@/lib/design/orbit";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pre-fetch the signed-in profile server-side so the sidebar renders the
  // real avatar/name on first paint — no client-side hydration flash.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const initialProfile = user
    ? (
        await supabase
          .from("profiles")
          .select(
            "id, username, display_name, avatar_url, is_verified, is_creator, is_admin",
          )
          .eq("id", user.id)
          .single()
      ).data
    : null;

  return (
    <div className="min-h-screen relative" style={orbitBg}>
      <Sidebar initialProfile={initialProfile} initialHasUser={!!user} />
      <TopBar />
      {user && <RealtimeBridge userId={user.id} />}

      <main className="lg:pl-[296px] lg:pr-6 min-h-screen pb-24 lg:pb-6 lg:pt-6 relative">
        <EmailVerificationBanner />
        {children}
      </main>

      {user && <PostComposer />}
      <BottomNav initialHasUser={!!user} />
    </div>
  );
}
