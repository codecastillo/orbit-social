"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ChevronRight, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NotificationItem,
  groupNotifications,
  type NotificationGroup,
} from "@/components/notifications/notification-item";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import { OrbitErrorState } from "@/components/orbit/error-state";
import { useNotifications, useUnreadCount } from "@/lib/hooks/use-notifications";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  markAllAsRead,
  type NotificationWithActor,
} from "@/lib/queries/notifications";
import { getIncomingFollowRequests } from "@/lib/queries/social";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "mentions", label: "Mentions" },
  { value: "likes", label: "Likes" },
  { value: "follows", label: "Follows" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

const FRESH_WINDOW_MS = 12 * 60 * 60 * 1000;

function isMatchingFilter(notif: NotificationWithActor, filter: FilterValue): boolean {
  if (filter === "all") return true;
  // Widened to string so the tabs keep matching legacy notification types that
  // are no longer emitted but still sit on older rows.
  const t: string = notif.type;
  if (filter === "mentions") return t === "mention" || t === "reply";
  if (filter === "likes") return t === "like" || t === "reaction";
  if (filter === "follows") return t === "follow" || t === "follow_request";
  return true;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const { data: notifications, isLoading, isError, refetch } = useNotifications();
  const { data: unreadCount } = useUnreadCount();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterValue>("all");

  // Only private accounts ever have rows here, so the banner self-hides for
  // everyone else without a separate is_private read.
  const { data: followRequests } = useQuery({
    queryKey: ["follow-requests", user?.id],
    queryFn: () => getIncomingFollowRequests(user!.id),
    enabled: !!user,
  });
  const pendingRequests = followRequests?.length ?? 0;

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllAsRead(user.id);
    queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
    queryClient.invalidateQueries({ queryKey: ["unread-count", user.id] });
  };

  const groups = groupNotifications(
    (notifications ?? []).filter((n) => isMatchingFilter(n, filter))
  );

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      {/* Editorial hero */}
      <div className="flex flex-wrap items-end justify-between gap-[18px]">
        <div>
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            ◇&nbsp;&nbsp;ACTIVITY{unreadCount ? ` · ${unreadCount} NEW` : ""}
          </p>
          <h1 className="mt-2 text-4xl sm:text-[48px] font-bold leading-none tracking-[-0.035em] text-foreground">
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

      {pendingRequests > 0 && (
        <Link
          href="/notifications/requests"
          className="flex items-center gap-3.5 rounded-xl border border-border bg-surface p-3.5 transition-colors hover:bg-surface-elevated"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <UserPlus className="h-[18px] w-[18px] text-primary" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-foreground">
              {pendingRequests} follow{" "}
              {pendingRequests === 1 ? "request" : "requests"}
            </p>
            <p className="text-[12.5px] text-muted-foreground">
              Approve who gets to see your posts
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

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
          headline="Couldn't load your"
          accentWord="notifications"
          sub="Something went wrong fetching your notifications."
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
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
      ) : groups.length === 0 ? (
        <OrbitEmptyState
          icon={Bell}
          accent="var(--warning)"
          headline="All"
          accentWord="caught up"
          sub="No new signals in your orbit. Come back later, or go post something and give someone else a reason to show up here."
        />
      ) : (
        <NotificationsList groups={groups} />
      )}
    </div>
  );
}

function NotificationsList({ groups }: { groups: NotificationGroup[] }) {
  // Group by NEW vs EARLIER (created within last 12h). A collapsed group sits
  // where its newest member does. The cutoff is pinned at mount so render
  // stays pure; the list refetches (and remounts the boundary) on its own.
  const [cutoff] = useState(() => Date.now() - FRESH_WINDOW_MS);
  const fresh: NotificationGroup[] = [];
  const earlier: NotificationGroup[] = [];
  groups.forEach((g) => {
    const t = new Date(g.lead.created_at).getTime();
    if (t >= cutoff && g.isUnread) fresh.push(g);
    else earlier.push(g);
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

function NotificationsSection({ items }: { items: NotificationGroup[] }) {
  return (
    <>
      {items.map((group, i) => (
        <div
          key={group.key}
          className={cn(
            "relative",
            i > 0 && "border-t border-border",
            group.isUnread && "bg-primary/[0.04]"
          )}
        >
          {group.isUnread && (
            <div className="absolute inset-y-0 left-0 w-[3px] bg-primary" />
          )}
          <NotificationItem group={group} />
        </div>
      ))}
    </>
  );
}
