"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationItem } from "@/components/notifications/notification-item";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import { OrbitErrorState } from "@/components/orbit/error-state";
import { useNotifications, useUnreadCount } from "@/lib/hooks/use-notifications";
import { useAuth } from "@/lib/hooks/use-auth";
import { markAllAsRead } from "@/lib/queries/notifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "mentions", label: "Mentions" },
  { value: "likes", label: "Likes" },
  { value: "follows", label: "Follows" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

function isMatchingFilter(notif: any, filter: FilterValue): boolean {
  if (filter === "all") return true;
  const t = notif.type;
  if (filter === "mentions") return t === "mention" || t === "reply";
  if (filter === "likes") return t === "like" || t === "reaction";
  if (filter === "follows") return t === "follow";
  return true;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const { data: notifications, isLoading, isError, refetch } = useNotifications();
  const { data: unreadCount } = useUnreadCount();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterValue>("all");

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllAsRead(user.id);
    queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
    queryClient.invalidateQueries({ queryKey: ["unread-count", user.id] });
  };

  const filtered = (notifications ?? []).filter((n) => isMatchingFilter(n, filter));

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      {/* Editorial hero */}
      <div className="flex flex-wrap items-end justify-between gap-[18px]">
        <div>
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            ◇&nbsp;&nbsp;ACTIVITY{unreadCount ? ` · ${unreadCount} NEW` : ""}
          </p>
          <h1 className="mt-2 text-[48px] font-bold leading-none tracking-[-0.035em] text-foreground">
            Signals from your <span className="text-primary">orbit</span>.
          </h1>
        </div>
        {!!unreadCount && unreadCount > 0 && (
          <Button variant="outline" size="lg" onClick={handleMarkAllRead}>
            <CheckCheck strokeWidth={1.8} />
            Mark all read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-surface p-[5px]">
        {FILTERS.map((f) => {
          const isActive = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "flex-1 cursor-pointer rounded-lg py-2.5 text-center text-[13px] font-semibold transition-all duration-150",
                isActive
                  ? "border border-border bg-primary/10 text-foreground"
                  : "border border-transparent text-muted-foreground"
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {isError ? (
        <OrbitErrorState
          headline="Couldn't"
          accentWord="reach"
          sub="Notifications didn't load. Probably a flaky connection, try again."
          errorCode="ERR · CONN_TIMEOUT"
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-3.5 rounded-xl border border-border bg-surface p-3.5"
            >
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <OrbitEmptyState
          icon={Bell}
          accent="var(--warning)"
          headline="All"
          accentWord="caught up"
          sub="No new signals in your orbit. Come back later, or go post something and give someone else a reason to show up here."
        />
      ) : (
        <NotificationsList notifications={filtered} />
      )}
    </div>
  );
}

function NotificationsList({ notifications }: { notifications: any[] }) {
  // Group by NEW vs EARLIER (created within last 12h)
  const cutoff = Date.now() - 1000 * 60 * 60 * 12;
  const fresh: any[] = [];
  const earlier: any[] = [];
  notifications.forEach((n) => {
    const t = new Date(n.created_at).getTime();
    if (t >= cutoff && !n.is_read) fresh.push(n);
    else earlier.push(n);
  });

  return (
    <div className="flex flex-col gap-[18px]">
      {fresh.length > 0 && (
        <Section label={`NEW · ${fresh.length}`} accent>
          <NotificationsSection items={fresh} />
        </Section>
      )}
      {earlier.length > 0 && (
        <Section label="EARLIER">
          <NotificationsSection items={earlier} />
        </Section>
      )}
    </div>
  );
}

function Section({
  label,
  accent,
  children,
}: {
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className={cn(
          "font-mono text-[10.5px] font-medium uppercase tracking-[0.18em]",
          accent ? "text-primary" : "text-muted-foreground"
        )}
      >
        ◇&nbsp;&nbsp;{label}
      </p>
      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
        {children}
      </div>
    </div>
  );
}

function NotificationsSection({ items }: { items: any[] }) {
  return (
    <>
      {items.map((notification, i) => {
        const isUnread = !notification.is_read;
        return (
          <div
            key={notification.id}
            className={cn(
              "relative",
              i > 0 && "border-t border-border",
              isUnread && "bg-primary/[0.04]"
            )}
          >
            {isUnread && (
              <div className="absolute inset-y-0 left-0 w-[3px] bg-primary" />
            )}
            <NotificationItem notification={notification} />
          </div>
        );
      })}
    </>
  );
}
