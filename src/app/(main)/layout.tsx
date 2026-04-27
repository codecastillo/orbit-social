export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TopBar } from "@/components/layout/top-bar";
import { EmailVerificationBanner } from "@/components/shared/email-verification-banner";
import { PostComposer } from "@/components/feed/post-composer";
import { orbitBg } from "@/lib/design/orbit";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen relative" style={orbitBg}>
      <Sidebar />
      <TopBar />

      <main className="lg:pl-[296px] lg:pr-6 min-h-screen pb-24 lg:pb-6 lg:pt-6 relative">
        <EmailVerificationBanner />
        {children}
      </main>

      <PostComposer />
      <BottomNav />
    </div>
  );
}
