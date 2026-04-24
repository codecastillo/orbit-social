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
    <div className="min-h-screen bg-background relative">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-[160px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-violet-500/[0.03] blur-[160px]" />
      </div>

      <Sidebar />
      <TopBar />

      <main className="lg:ml-[76px] min-h-screen pb-24 lg:pb-0 relative">
        <EmailVerificationBanner />
        <div className="mx-auto max-w-2xl w-full">{children}</div>
      </main>

      <RightPanel />
      <BottomNav />
    </div>
  );
}
