export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TopBar } from "@/components/layout/top-bar";
import { RealtimeBridge } from "@/components/layout/realtime-bridge";
import { EmailVerificationBanner } from "@/components/shared/email-verification-banner";
import { LazyPostComposer } from "@/components/feed/post-composer-lazy";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pre-fetch the signed-in profile server-side so the sidebar renders the
  // real avatar/name on first paint, no client-side hydration flash.
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
    <div className="min-h-screen relative bg-background">
      <Sidebar initialProfile={initialProfile} initialHasUser={!!user} />
      <TopBar />
      {user && <RealtimeBridge userId={user.id} />}

      <main
        id="main-content"
        className="lg:pl-[260px] min-h-screen pb-24 lg:pb-6 lg:pt-6 relative"
      >
        <EmailVerificationBanner />
        {/* One shared gutter for every page; without it cards sit flush
            against the viewport edge on phones. Full-bleed surfaces (clips)
            use fixed positioning and are unaffected. */}
        <div className="px-4 sm:px-5 lg:px-8">{children}</div>
      </main>

      {user && <LazyPostComposer />}
      <BottomNav initialHasUser={!!user} />
    </div>
  );
}
