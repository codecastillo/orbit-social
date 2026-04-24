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
      {/* Header */}
      <div
        className="sticky top-0 z-10"
        style={{
          background: "oklch(0.14 0.02 270 / 0.7)",
          backdropFilter: "blur(40px) saturate(2)",
          WebkitBackdropFilter: "blur(40px) saturate(2)",
          borderBottom: "1px solid oklch(1 0 0 / 0.05)",
        }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-500/25 to-orange-500/20 flex items-center justify-center border border-white/[0.06] relative">
              <Bell className="h-5 w-5 text-amber-300" />
              {!!unreadCount && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] font-bold text-white bg-destructive rounded-full ring-2 ring-background">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1
                className="text-2xl font-extrabold tracking-tight"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                Notifications
              </h1>
              <p className="text-[12px] text-muted-foreground mt-0.5 font-medium">
                {unreadCount ? `${unreadCount} new` : "You're all caught up"}
              </p>
            </div>
          </div>
          {!!unreadCount && unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground rounded-2xl h-9 px-3.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
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
          <p className="text-base font-semibold text-foreground/80">
            Something went wrong
          </p>
          <button
            onClick={() => refetch()}
            className="text-primary text-sm font-semibold hover:underline mt-3"
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
              <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : !notifications || notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="h-20 w-20 rounded-3xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5">
            <Bell className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="text-base font-semibold text-foreground/80">
            All caught up
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1.5">
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
                  : "bg-primary/[0.04] border-primary/[0.12] hover:bg-primary/[0.06]"
              }`}
            >
              {!notification.is_read && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-l-2xl shadow-[0_0_10px_oklch(0.623_0.214_259_/_0.6)]" />
              )}
              <NotificationItem notification={notification} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
