"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-border bg-background px-4 py-3 lg:hidden">
      <Link
        href="/feed"
        className="flex shrink-0 items-center gap-2 text-foreground no-underline"
      >
        <div className="relative h-7 w-7 rounded-md bg-primary">
          <div className="absolute inset-[3px] rounded-[5px] border-[1.5px] border-primary-foreground/50" />
        </div>
        <span className="text-[22px] font-bold tracking-tight">Orbit</span>
      </Link>

      <div className="flex-1" />

      <div className="flex shrink-0 gap-2">
        <Link
          href="/explore"
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary no-underline"
        >
          <Search className="h-4 w-4" />
        </Link>
        <NotificationBell />
      </div>
    </header>
  );
}
