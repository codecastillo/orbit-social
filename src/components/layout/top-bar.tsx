"use client";

import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function TopBar() {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 h-14 px-4 lg:hidden"
      style={{
        background: "oklch(0.14 0.02 270 / 0.7)",
        backdropFilter: "blur(40px) saturate(2)",
        WebkitBackdropFilter: "blur(40px) saturate(2)",
        borderBottom: "1px solid oklch(1 0 0 / 0.06)",
      }}
    >
      {/* Logo chip */}
      <Link href="/feed" className="flex items-center gap-2.5 flex-shrink-0">
        <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-[0_4px_16px_oklch(0.623_0.214_259_/_0.4)]">
          <span className="text-base font-extrabold text-primary-foreground">O</span>
        </div>
      </Link>

      {/* Search */}
      <div className="flex-1">
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search Orbit"
            className="w-full h-10 pl-10 pr-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/40 focus:bg-white/[0.06] transition-all duration-200"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <NotificationBell />
        <Link
          href="/messages"
          className="h-10 w-10 flex items-center justify-center rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
        >
          <MessageCircle className="h-[18px] w-[18px] text-foreground" />
        </Link>
      </div>
    </header>
  );
}
