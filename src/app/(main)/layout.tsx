export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TopBar } from "@/components/layout/top-bar";
import { RightPanel } from "@/components/layout/right-panel";
import { EmailVerificationBanner } from "@/components/shared/email-verification-banner";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <TopBar />

      {/* Main content area */}
      <main className="lg:ml-[72px] min-h-screen pb-20 lg:pb-0">
        <EmailVerificationBanner />
        <div className="mx-auto max-w-2xl w-full">{children}</div>
      </main>

      <RightPanel />
      <BottomNav />
    </div>
  );
}
