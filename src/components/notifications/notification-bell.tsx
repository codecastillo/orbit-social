"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useUnreadCount } from "@/lib/hooks/use-notifications";

export function NotificationBell() {
  const { data: count } = useUnreadCount();

  return (
    <Link
      href="/notifications"
      className="relative p-2 rounded-full hover:bg-accent transition-colors"
    >
      <Bell className="h-5 w-5" />
      {!!count && count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-destructive rounded-full">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
