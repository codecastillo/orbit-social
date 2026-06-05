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

// Pick the noun for a post-shaped notification: a reel reads as "clip",
// a post inside a community gets " in <room>", everything else is plain
// "post". Result reads like a sentence, e.g.:
//   "your clip"
//   "your post"
//   "your post in Sneakerheads"
function postNoun(post: NotificationWithActor["entity_post"]): string {
  if (!post) return "post";
  const base = post.type === "reel" ? "clip" : "post";
  return post.community_name ? `${base} in ${post.community_name}` : base;
}

function getNotificationText(notification: NotificationWithActor): string {
  const name = notification.profiles.display_name || notification.profiles.username;
  const entity = notification.entity_type;
  const post = notification.entity_post;

  switch (notification.type) {
    case "like":
      if (entity === "comment") return `${name} liked your comment`;
      return `${name} liked your ${postNoun(post)}`;
    case "comment":
      if (entity === "event") return `${name} replied to your event comment`;
      if (entity === "comment") return `${name} replied to your comment`;
      return `${name} replied to your ${postNoun(post)}`;
    case "quote":
      return `${name} quoted your ${postNoun(post)}`;
    case "follow":
      return `${name} followed you`;
    case "mention":
      if (entity === "event") return `${name} mentioned you in an event`;
      if (entity === "community") return `${name} mentioned you in a room`;
      if (post?.community_name)
        return `${name} mentioned you in ${post.community_name}`;
      return `${name} mentioned you`;
    case "repost":
      return `${name} reposted your ${postNoun(post)}`;
    case "message":
      return `${name} sent you a message`;
    case "story_reaction":
      return `${name} reacted to your story`;
    case "live_started":
      return `${name} just went live`;
    case "community_invite":
      return `${name} invited you to a room`;
    case "event_invite":
      // Used by 00017 for "new RSVP on your event", surface that meaning.
      if (entity === "event") return `${name} RSVP'd to your event`;
      return `${name} invited you to an event`;
    case "event_reminder":
      return `Heads up, your event starts soon`;
    default:
      return `${name} interacted with you`;
  }
}

function getNotificationHref(notification: NotificationWithActor): string {
  const entity = notification.entity_type;
  const post = notification.entity_post;
  switch (notification.type) {
    case "follow":
      return `/${notification.profiles.username}`;
    case "like":
    case "comment":
    case "mention":
    case "repost":
    case "quote":
      if (entity === "event" && notification.entity_id) {
        return `/events/${notification.entity_id}`;
      }
      if (entity === "community" && notification.entity_id) {
        return `/communities/${notification.entity_id}`;
      }
      // Clips have no per-clip page yet, route to the global clips feed.
      if (post?.type === "reel") return "/clips";
      return notification.entity_id ? `/post/${notification.entity_id}` : "/notifications";
    case "message":
      return notification.entity_id
        ? `/messages/${notification.entity_id}`
        : "/messages";
    case "live_started":
      return notification.entity_id
        ? `/live/${notification.entity_id}`
        : "/live";
    case "community_invite":
      return notification.entity_id
        ? `/communities/${notification.entity_id}`
        : "/communities";
    case "event_invite":
    case "event_reminder":
      return notification.entity_id
        ? `/events/${notification.entity_id}`
        : "/events";
    case "story_reaction":
      return notification.entity_id
        ? `/stories/${notification.entity_id}`
        : "/notifications";
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
