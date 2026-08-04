"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/utils/format";
import { UserAvatar } from "@/components/shared/user-avatar";
import { markManyAsRead } from "@/lib/queries/notifications";
import { useAuth } from "@/lib/hooks/use-auth";
import { useUIStore } from "@/lib/stores/ui-store";
import type { NotificationWithActor } from "@/lib/queries/notifications";

type Actor = NonNullable<NotificationWithActor["profiles"]>;

/**
 * One rendered row: either a single notification or several of the same kind
 * collapsed into "Ana and 3 others liked your post".
 */
export interface NotificationGroup {
  key: string;
  /** Newest member; drives the copy, the destination, and the timestamp. */
  lead: NotificationWithActor;
  members: NotificationWithActor[];
  /** Distinct actors, newest first, for the overlapping avatar stack. */
  actors: Actor[];
  /** Distinct actors besides the lead's; 0 means render as a single row. */
  othersCount: number;
  isUnread: boolean;
}

interface NotificationItemProps {
  group: NotificationGroup;
}

// Only types where the individual actor stops mattering once there are
// several collapse. Messages, mentions, quotes, invites, and the system rows
// each carry detail that a count would throw away. follow_request stays out
// deliberately: every one of them is a separate approve-or-deny decision, so
// collapsing them into "and 3 others" would hide the work.
const MAX_STACKED_AVATARS = 3;

const GROUPABLE_TYPES: ReadonlySet<NotificationWithActor["type"]> = new Set([
  "like",
  "repost",
  "follow",
]);

// Follow rows store the follower as their entity, so keying on the entity
// would never collapse two of them; they group on type alone.
function groupKey(notification: NotificationWithActor): string | null {
  if (!GROUPABLE_TYPES.has(notification.type)) return null;
  if (notification.type === "follow") return "follow";
  if (!notification.entity_id) return null;
  return `${notification.type}:${notification.entity_type ?? ""}:${notification.entity_id}`;
}

/**
 * Collapse a newest-first page of notifications into display rows. Grouping is
 * client-side over whatever is loaded, so a group grows as more pages arrive.
 */
export function groupNotifications(
  notifications: NotificationWithActor[]
): NotificationGroup[] {
  const rows: NotificationGroup[] = [];
  const byKey = new Map<string, { group: NotificationGroup; actorIds: Set<string> }>();

  for (const notification of notifications) {
    const key = groupKey(notification);
    const actor = notification.profiles;
    if (!key) {
      rows.push({
        key: notification.id,
        lead: notification,
        members: [notification],
        actors: actor ? [actor] : [],
        othersCount: 0,
        isUnread: !notification.is_read,
      });
      continue;
    }

    const existing = byKey.get(key);
    if (!existing) {
      const group: NotificationGroup = {
        key,
        lead: notification,
        members: [notification],
        actors: actor ? [actor] : [],
        othersCount: 0,
        isUnread: !notification.is_read,
      };
      // A system row has no actor, so fall back to its id to keep the count honest.
      byKey.set(key, {
        group,
        actorIds: new Set([notification.actor_id ?? notification.id]),
      });
      rows.push(group);
      continue;
    }

    existing.group.members.push(notification);
    if (!notification.is_read) existing.group.isUnread = true;
    const actorKey = notification.actor_id ?? notification.id;
    if (!existing.actorIds.has(actorKey)) {
      existing.actorIds.add(actorKey);
      existing.group.othersCount = existing.actorIds.size - 1;
      if (actor && existing.group.actors.length < MAX_STACKED_AVATARS) {
        existing.group.actors.push(actor);
      }
    }
  }

  return rows;
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

// `subject` overrides the actor name so a collapsed group can read
// "Ana and 3 others liked your post" without restating every phrase.
function getNotificationText(
  notification: NotificationWithActor,
  subject?: string
): string {
  const actor = notification.profiles;
  const name = subject ?? (actor ? actor.display_name || actor.username : "Orbit");
  const entity = notification.entity_type;
  const post = notification.entity_post;

  switch (notification.type) {
    case "moment_prompt":
      return "Time for today's moment";
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
    case "follow_request":
      return `${name} requested to follow you`;
    case "mention":
      if (entity === "event") return `${name} mentioned you in an event`;
      if (entity === "community") return `${name} mentioned you in a room`;
      if (post?.community_name)
        return `${name} mentioned you in ${post.community_name}`;
      return `${name} mentioned you`;
    case "repost":
      return `${name} reposted your ${postNoun(post)}`;
    case "new_post":
      return `${name} posted something new`;
    case "message":
      return `${name} sent you a message`;
    case "story_reaction":
      return `${name} reacted to your moment`;
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
    case "moment_prompt":
      // The story bar lives on the home feed; handleClick opens its creator.
      return "/";
    case "follow":
      return notification.profiles
        ? `/${notification.profiles.username}`
        : "/notifications";
    case "follow_request":
      return "/notifications/requests";
    case "like":
    case "comment":
    case "mention":
    case "repost":
    case "quote":
    case "new_post":
      if (entity === "event" && notification.entity_id) {
        return `/events/${notification.entity_id}`;
      }
      if (entity === "community" && notification.entity_id) {
        return `/communities/${notification.entity_id}`;
      }
      if (post?.type === "reel" && notification.entity_id) {
        return `/clips/${notification.entity_id}`;
      }
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
      // There is no per-story route; the reactor's profile carries their
      // active stories, so send the owner there instead of a 404.
      return notification.profiles?.username
        ? `/${notification.profiles.username}`
        : "/notifications";
    default:
      return "/notifications";
  }
}

export function NotificationItem({ group }: NotificationItemProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const setMomentCreatorOpen = useUIStore((s) => s.setMomentCreatorOpen);

  const notification = group.lead;
  const leadName = notification.profiles
    ? notification.profiles.display_name || notification.profiles.username
    : "Orbit";
  const subject =
    group.othersCount > 0
      ? `${leadName} and ${group.othersCount} ${group.othersCount === 1 ? "other" : "others"}`
      : undefined;

  const handleClick = async () => {
    const unreadIds = group.members.filter((m) => !m.is_read).map((m) => m.id);
    if (unreadIds.length > 0) {
      await markManyAsRead(unreadIds);
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["unread-count", user?.id] });
    }
    // The moment creator is a dialog on the home feed's story bar, not a
    // route, so raise its flag and let the feed open it on arrival.
    if (notification.type === "moment_prompt") {
      setMomentCreatorOpen(true);
    }
    router.push(getNotificationHref(notification));
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-start gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-accent/50",
        group.isUnread && "bg-primary/5"
      )}
    >
      {group.actors.length > 1 ? (
        <div className="flex shrink-0 -space-x-2.5">
          {group.actors.map((actor) => (
            <UserAvatar
              key={actor.id}
              src={actor.avatar_url}
              fallback={actor.display_name || actor.username}
              size="sm"
              className="ring-2 ring-surface"
            />
          ))}
        </div>
      ) : (
        <UserAvatar
          src={notification.profiles?.avatar_url ?? null}
          fallback={leadName}
          size="sm"
        />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          {getNotificationText(notification, subject)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatTimeAgo(notification.created_at)}
        </p>
      </div>

      {group.isUnread && (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}
