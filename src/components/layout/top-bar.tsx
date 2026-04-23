"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { APP_NAME } from "@/lib/utils/constants";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-background/85 backdrop-blur-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] lg:hidden">
      <Link href="/feed" className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
          <span className="text-sm font-extrabold text-primary-foreground">O</span>
        </div>
        <h1 className="text-xl font-extrabold tracking-tight text-gradient">{APP_NAME}</h1>
      </Link>

      <div className="flex items-center gap-1.5">
        <NotificationBell />
        <Link
          href="/messages"
          className="h-10 w-10 flex items-center justify-center rounded-full bg-accent/60 hover:bg-accent transition-colors"
        >
          <MessageCircle className="h-[20px] w-[20px] text-foreground" />
        </Link>
      </div>
    </header>
  );
}
