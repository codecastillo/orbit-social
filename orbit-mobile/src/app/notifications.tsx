import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import {
  NOTIFICATION_PAGE_SIZE,
  getNotifications,
  markManyAsRead,
  type NotificationWithActor,
} from "@/lib/queries/notifications";
import { formatTimeAgo } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const DAYS_IN_WEEK_SECTION = 7;
const MONO_FONT = Platform.select({ ios: "Menlo", default: "monospace" });
const MAX_STACKED_AVATARS = 3;
const STACKED_AVATAR_SIZE = 34;
const STACKED_AVATAR_OVERLAP = 12;

const FILTERS = [
  { value: "all", label: "All" },
  { value: "mentions", label: "Mentions" },
  { value: "likes", label: "Likes" },
  { value: "follows", label: "Follows" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

// Buckets mirror the web activity page, aliases included, so a given row
// lands under the same tab on both platforms.
const FILTER_TYPES: Record<Exclude<FilterValue, "all">, readonly string[]> = {
  mentions: ["mention", "reply"],
  likes: ["like", "reaction"],
  follows: ["follow"],
};

function matchesFilter(
  notification: NotificationWithActor,
  filter: FilterValue,
): boolean {
  if (filter === "all") return true;
  return FILTER_TYPES[filter].includes(notification.type);
}

// Simplified from the web notification-item mapping: no post hydration on
// mobile yet, so post-shaped notifications all read as "post". The actor
// name renders separately in bold, so phrases start at the verb.
// event_reminder and moment_prompt are the types with no meaningful actor;
// they render as a standalone sentence instead.
function notificationPhrase(notification: NotificationWithActor): string {
  const entity = notification.entity_type;

  switch (notification.type) {
    case "like":
      if (entity === "comment") return "liked your comment";
      return "liked your post";
    case "comment":
      if (entity === "comment") return "replied to your comment";
      return "replied to your post";
    case "quote":
      return "quoted your post";
    case "follow":
      return "followed you";
    case "mention":
      return "mentioned you";
    case "repost":
      return "reposted your post";
    case "new_post":
      return "posted something new";
    case "message":
      return "sent you a message";
    case "story_reaction":
      return "reacted to your moment";
    case "live_started":
      return "just went live";
    case "community_invite":
      return "invited you to a room";
    case "event_invite":
      return "invited you to an event";
    default:
      return "interacted with you";
  }
}

type Actor = NonNullable<NotificationWithActor["profiles"]>;

/**
 * One rendered row: either a single notification or several of the same kind
 * collapsed into "Ana and 3 others liked your post".
 */
interface NotificationGroup {
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

// Only types where the individual actor stops mattering once there are
// several collapse. Messages, mentions, quotes, invites, and the system rows
// each carry detail that a count would throw away.
const GROUPABLE_TYPES: ReadonlySet<string> = new Set(["like", "repost", "follow"]);

// Follow rows store the follower as their entity, so keying on the entity
// would never collapse two of them; they group on type alone.
function groupKey(notification: NotificationWithActor): string | null {
  if (!GROUPABLE_TYPES.has(notification.type)) return null;
  if (notification.type === "follow") return "follow";
  if (!notification.entity_id) return null;
  return `${notification.type}:${notification.entity_type ?? ""}:${notification.entity_id}`;
}

/**
 * Collapse a newest-first list of notifications into display rows. Grouping is
 * client-side over the loaded pages, so a group grows as more pages arrive.
 */
function groupNotifications(
  notifications: NotificationWithActor[],
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

type SectionLabel = "Today" | "This week" | "Earlier";

function sectionLabel(iso: string): SectionLabel {
  const created = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (created >= startOfToday) return "Today";
  const weekStart = new Date(startOfToday);
  weekStart.setDate(weekStart.getDate() - (DAYS_IN_WEEK_SECTION - 1));
  if (created >= weekStart) return "This week";
  return "Earlier";
}

// Flattened list keeps FlatList's cursor pagination intact while still
// rendering IG-style time section headers.
type ActivityItem =
  | { kind: "header"; label: SectionLabel }
  | { kind: "notification"; group: NotificationGroup };

function buildActivityItems(groups: NotificationGroup[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  let currentLabel: SectionLabel | null = null;
  for (const group of groups) {
    const label = sectionLabel(group.lead.created_at);
    if (label !== currentLabel) {
      items.push({ kind: "header", label });
      currentLabel = label;
    }
    items.push({ kind: "notification", group });
  }
  return items;
}

function ActorStack({ actors }: { actors: Actor[] }) {
  return (
    <View style={styles.stack}>
      {actors.map((actor, index) => (
        <View
          key={actor.id}
          style={[
            styles.stackAvatar,
            index > 0 && { marginLeft: -STACKED_AVATAR_OVERLAP },
          ]}
        >
          <Avatar
            url={actor.avatar_url}
            name={actor.display_name || actor.username}
            size={STACKED_AVATAR_SIZE}
          />
        </View>
      ))}
    </View>
  );
}

function NotificationRow({
  group,
  onPress,
}: {
  group: NotificationGroup;
  onPress: (group: NotificationGroup) => void;
}) {
  const notification = group.lead;
  const actor = notification.profiles;
  const actorName = actor ? actor.display_name || actor.username : "Orbit";
  const others = group.othersCount;
  const systemLine =
    notification.type === "event_reminder"
      ? "Heads up, your event starts soon"
      : notification.type === "moment_prompt"
        ? "Time for today's moment"
        : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(group)}
      style={({ pressed }) => [
        styles.row,
        group.isUnread && styles.rowUnread,
        pressed && { opacity: 0.75 },
      ]}
    >
      {group.actors.length > 1 ? (
        <ActorStack actors={group.actors} />
      ) : (
        <Avatar url={actor?.avatar_url ?? null} name={actorName} size={44} />
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowText}>
          {systemLine ? (
            systemLine
          ) : (
            <>
              <Text style={styles.rowActor}>{actorName}</Text>
              {others > 0 ? ` and ${others} ${others === 1 ? "other" : "others"}` : ""}{" "}
              {notificationPhrase(notification)}
            </>
          )}
          <Text style={styles.rowTime}> {formatTimeAgo(notification.created_at)}</Text>
        </Text>
      </View>
    </Pressable>
  );
}

function FilterTabs({
  active,
  onChange,
}: {
  active: FilterValue;
  onChange: (filter: FilterValue) => void;
}) {
  return (
    <View style={styles.tabBar}>
      {FILTERS.map((filter) => {
        const isActive = filter.value === active;
        return (
          <Pressable
            key={filter.value}
            accessibilityRole="tab"
            accessibilityLabel={filter.label}
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(filter.value)}
            style={[styles.tab, isActive && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterValue>("all");

  const {
    data,
    isPending,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["notifications", user?.id],
    queryFn: ({ pageParam }) => getNotifications(user!.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length < NOTIFICATION_PAGE_SIZE
        ? undefined
        : lastPage[lastPage.length - 1]?.created_at,
    enabled: !!user,
  });

  const readMutation = useMutation({
    mutationFn: markManyAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  const handlePress = useCallback(
    (group: NotificationGroup) => {
      const unreadIds = group.members.filter((m) => !m.is_read).map((m) => m.id);
      if (unreadIds.length > 0) {
        readMutation.mutate(unreadIds);
      }
      const notification = group.lead;
      // Only the destinations with a mobile screen navigate; the other
      // types just mark read, as before.
      if (notification.type === "new_post" && notification.entity_id) {
        router.push(`/post/${notification.entity_id}`);
      } else if (
        notification.type === "event_reminder" &&
        notification.entity_id
      ) {
        router.push(`/events/${notification.entity_id}`);
      } else if (notification.type === "moment_prompt") {
        router.push("/moment-camera");
      }
    },
    [readMutation, router],
  );

  const items = useMemo(
    () =>
      buildActivityItems(
        groupNotifications(
          (data?.pages.flat() ?? []).filter((n) => matchesFilter(n, filter)),
        ),
      ),
    [data, filter],
  );

  if (!user) return null;

  if (isPending) {
    return (
      <Centered>
        <ActivityIndicator color={colors.primary} />
      </Centered>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="Activity did not load"
        description="Check your connection and try again."
        action={<Button label="Retry" variant="outline" onPress={() => refetch()} />}
      />
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={items}
      keyExtractor={(item) =>
        item.kind === "header" ? `header-${item.label}` : item.group.key
      }
      renderItem={({ item }) =>
        item.kind === "header" ? (
          <Text style={styles.sectionHeader}>{item.label}</Text>
        ) : (
          <NotificationRow group={item.group} onPress={handlePress} />
        )
      }
      ListHeaderComponent={<FilterTabs active={filter} onChange={setFilter} />}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.mutedForeground}
        />
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        <EmptyState
          title="Nothing here yet"
          description="Likes, replies, follows, and invites will show up here."
        />
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator
            color={colors.mutedForeground}
            style={{ paddingVertical: spacing(4) }}
          />
        ) : null
      }
      contentContainerStyle={items.length === 0 ? { flex: 1 } : undefined}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: "row",
    gap: spacing(1),
    marginHorizontal: spacing(4),
    marginTop: spacing(3),
    padding: spacing(1),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing(2),
    borderRadius: radii.sm,
  },
  // Violet wash rather than a solid fill, matching the web activity tabs.
  tabActive: {
    backgroundColor: colors.primary + "1f",
  },
  tabLabel: {
    color: colors.mutedForeground,
    fontFamily: MONO_FONT,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tabLabelActive: {
    color: colors.foreground,
  },
  stack: {
    flexDirection: "row",
    alignItems: "center",
  },
  stackAvatar: {
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.background,
    overflow: "hidden",
  },
  sectionHeader: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    paddingBottom: spacing(2),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  rowUnread: {
    backgroundColor: colors.surface,
  },
  rowBody: {
    flex: 1,
  },
  rowText: {
    color: colors.foreground,
    fontSize: 13,
    lineHeight: 18,
  },
  rowActor: {
    fontWeight: "700",
  },
  rowTime: {
    color: colors.mutedForeground,
  },
});
