"use client";

import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { APP_NAME } from "@/lib/utils/constants";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 glass shadow-[0_2px_16px_oklch(0_0_0_/_25%)] lg:hidden" style={{ borderBottom: "none" }}>
      {/* Logo */}
      <Link href="/feed" className="flex items-center gap-2 flex-shrink-0">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm glow-box">
          <span className="text-sm font-extrabold text-primary-foreground">O</span>
        </div>
        <h1 className="text-xl font-extrabold tracking-tight text-gradient">{APP_NAME}</h1>
      </Link>

      {/* Search (mobile) */}
      <div className="flex-1 max-w-xs mx-4">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full h-9 pl-9 pr-3 rounded-full bg-white/[0.04] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 focus:shadow-[0_0_12px_oklch(0.623_0.214_259_/_15%)] transition-all duration-200"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <NotificationBell />
        <Link
          href="/messages"
          className="h-9 w-9 flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.10] hover:shadow-[0_0_10px_oklch(1_0_0_/_8%)] transition-all duration-200"
        >
          <MessageCircle className="h-[18px] w-[18px] text-foreground" />
        </Link>
      </div>
    </header>
  );
}
