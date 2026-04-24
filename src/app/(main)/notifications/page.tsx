"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationItem } from "@/components/notifications/notification-item";
import { useNotifications, useUnreadCount } from "@/lib/hooks/use-notifications";
import { useAuth } from "@/lib/hooks/use-auth";
import { markAllAsRead } from "@/lib/queries/notifications";

export default function NotificationsPage() {
  const { user } = useAuth();
  const { data: notifications, isLoading, isError, refetch } = useNotifications();
  const { data: unreadCount } = useUnreadCount();
  const queryClient = useQueryClient();

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllAsRead(user.id);
    queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
    queryClient.invalidateQueries({ queryKey: ["unread-count", user.id] });
  };

  return (
    <div className="min-h-screen">
      {/* Header — frosted glass with bell icon and unread badge */}
      <div className="sticky top-0 z-10 backdrop-blur-2xl bg-background/80 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center relative">
              <Bell className="h-4.5 w-4.5 text-amber-400" />
              {!!unreadCount && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-white bg-destructive rounded-full ring-2 ring-background">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">Notifications</h1>
          </div>
          {!!unreadCount && unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground rounded-full h-9 px-4 bg-white/[0.04] backdrop-blur-xl hover:bg-white/[0.08] border border-white/[0.06]"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-4 w-4 mr-1.5" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-5">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <p className="text-lg font-semibold text-foreground/80">Something went wrong</p>
          <p className="text-sm mt-1.5 text-muted-foreground/70">
            Failed to load notifications. Please try again.
          </p>
          <button
            onClick={() => refetch()}
            className="text-primary text-sm font-medium hover:underline mt-3"
          >
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04]"
            >
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : !notifications || notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-16 w-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-5">
            <Bell className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-base font-semibold text-muted-foreground">All caught up</p>
          <p className="text-sm text-muted-foreground/60 mt-1.5">
            No new notifications right now.
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`relative rounded-2xl border transition-all overflow-hidden ${
                notification.is_read
                  ? "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]"
                  : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] shadow-sm shadow-primary/5"
              }`}
            >
              {/* Unread glow bar — 3px primary left border */}
              {!notification.is_read && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-l-2xl shadow-[0_0_8px_rgba(124,58,237,0.4)]" />
              )}
              <NotificationItem notification={notification} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
