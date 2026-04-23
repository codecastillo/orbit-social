export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TopBar } from "@/components/layout/top-bar";
import { RightPanel } from "@/components/layout/right-panel";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <TopBar />

      {/* Main content area */}
      <main className="lg:ml-[260px] xl:mr-[320px] min-h-screen pb-16 lg:pb-0">
        <div className="mx-auto max-w-[600px] w-full">{children}</div>
      </main>

      <RightPanel />
      <BottomNav />
    </div>
  );
}
