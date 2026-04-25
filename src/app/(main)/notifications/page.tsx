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
import { O, aurora, auroraSoft, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";

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
    <div
      style={{
        color: O.ink,
        fontFamily: O.sans,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {/* Editorial hero */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Eyebrow accent>
            ◇&nbsp;&nbsp;ACTIVITY · {unreadCount ? `${unreadCount} NEW` : "ALL READ"}
          </Eyebrow>
          <Display size={48} style={{ marginTop: 8 }}>
            Signals from your <Acc>orbit</Acc>.
          </Display>
        </div>
        {!!unreadCount && unreadCount > 0 && (
          <PillBtn size="lg" onClick={handleMarkAllRead}>
            <CheckCheck style={{ width: 14, height: 14 }} strokeWidth={1.8} />
            Mark all read
          </PillBtn>
        )}
      </div>

      {/* Filter tabs */}
      <div
        style={{
          ...panel({ borderRadius: 16 }),
          padding: 5,
          display: "flex",
          gap: 4,
        }}
      >
        {FILTERS.map((f) => {
          const isActive = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "10px 0",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: isActive ? auroraSoft : "transparent",
                border: isActive
                  ? `1px solid ${O.hair2}`
                  : "1px solid transparent",
                color: isActive ? O.ink : O.ink3,
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
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
          sub="Notifications didn't load. Probably a flaky connection — try again."
          errorCode="ERR · CONN_TIMEOUT"
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <div
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                ...panel({ borderRadius: 18 }),
                padding: 14,
                display: "flex",
                gap: 14,
              }}
            >
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div style={{ flex: 1 }} className="space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <OrbitEmptyState
          icon={Bell}
          accent="#ffd76a"
          headline="All"
          accentWord="caught up"
          sub="No new signals in your orbit. Come back later — or go post something and give someone else a reason to show up here."
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
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
      <Eyebrow accent={accent}>◇&nbsp;&nbsp;{label}</Eyebrow>
      <div
        style={{
          ...panel(),
          padding: 0,
          marginTop: 12,
          overflow: "hidden",
        }}
      >
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
            style={{
              position: "relative",
              borderTop: i ? `1px solid ${O.hair}` : "none",
              background: isUnread ? `${O.a2}0a` : "transparent",
            }}
          >
            {isUnread && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: aurora,
                  boxShadow: `0 0 12px ${O.a2}80`,
                }}
              />
            )}
            <NotificationItem notification={notification} />
          </div>
        );
      })}
    </>
  );
}
