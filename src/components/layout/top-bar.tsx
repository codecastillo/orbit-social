"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { APP_NAME } from "@/lib/utils/constants";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-12 px-4 border-b border-border bg-background/80 backdrop-blur-xl lg:hidden">
      <Link href="/feed">
        <h1 className="text-lg font-bold text-gradient">{APP_NAME}</h1>
      </Link>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <Link
          href="/messages"
          className="p-2 rounded-full hover:bg-accent transition-colors"
        >
          <MessageCircle className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
