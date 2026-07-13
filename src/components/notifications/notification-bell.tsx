"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useUnreadCount } from "@/lib/hooks/use-notifications";

export function NotificationBell() {
  const { data: count } = useUnreadCount();

  return (
    <Link
      href="/notifications"
      aria-label="Notifications"
      className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors hover:text-foreground"
    >
      <Bell className="h-4 w-4" />
      {!!count && count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-destructive rounded-full">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
