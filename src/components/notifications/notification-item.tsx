"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/utils/format";
import { UserAvatar } from "@/components/shared/user-avatar";
import { markAsRead } from "@/lib/queries/notifications";
import { useAuth } from "@/lib/hooks/use-auth";
import type { NotificationWithActor } from "@/lib/queries/notifications";

interface NotificationItemProps {
  notification: NotificationWithActor;
}

function getNotificationText(notification: NotificationWithActor): string {
  const name = notification.profiles.display_name || notification.profiles.username;

  switch (notification.type) {
    case "like":
      return `${name} liked your post`;
    case "comment":
      return `${name} replied to your post`;
    case "follow":
      return `${name} followed you`;
    case "mention":
      return `${name} mentioned you`;
    case "repost":
      return `${name} reposted your post`;
    default:
      return `${name} interacted with you`;
  }
}

function getNotificationHref(notification: NotificationWithActor): string {
  switch (notification.type) {
    case "follow":
      return `/${notification.profiles.username}`;
    case "like":
    case "comment":
    case "mention":
    case "repost":
      return notification.entity_id ? `/post/${notification.entity_id}` : "/notifications";
    default:
      return "/notifications";
  }
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const handleClick = async () => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["unread-count", user?.id] });
    }
    router.push(getNotificationHref(notification));
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-start gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-accent/50",
        !notification.is_read && "bg-primary/5"
      )}
    >
      <UserAvatar
        src={notification.profiles.avatar_url}
        fallback={notification.profiles.display_name || notification.profiles.username}
        size="sm"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          {getNotificationText(notification)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatTimeAgo(notification.created_at)}
        </p>
      </div>

      {!notification.is_read && (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}
