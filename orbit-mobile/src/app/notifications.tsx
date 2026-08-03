import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
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
  markAsRead,
  type NotificationWithActor,
} from "@/lib/queries/notifications";
import { formatTimeAgo } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { colors, spacing } from "@/lib/theme";

const DAYS_IN_WEEK_SECTION = 7;

// Simplified from the web notification-item mapping: no post hydration on
// mobile yet, so post-shaped notifications all read as "post". The actor
// name renders separately in bold, so phrases start at the verb.
// event_reminder is the one type with no meaningful actor.
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
      return "reacted to your story";
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
  | { kind: "notification"; notification: NotificationWithActor };

function buildActivityItems(notifications: NotificationWithActor[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  let currentLabel: SectionLabel | null = null;
  for (const notification of notifications) {
    const label = sectionLabel(notification.created_at);
    if (label !== currentLabel) {
      items.push({ kind: "header", label });
      currentLabel = label;
    }
    items.push({ kind: "notification", notification });
  }
  return items;
}

function NotificationRow({
  notification,
  onPress,
}: {
  notification: NotificationWithActor;
  onPress: (notification: NotificationWithActor) => void;
}) {
  const actorName =
    notification.profiles.display_name || notification.profiles.username;
  const isReminder = notification.type === "event_reminder";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(notification)}
      style={({ pressed }) => [
        styles.row,
        !notification.is_read && styles.rowUnread,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Avatar url={notification.profiles.avatar_url} name={actorName} size={44} />
      <View style={styles.rowBody}>
        <Text style={styles.rowText}>
          {isReminder ? (
            "Heads up, your event starts soon"
          ) : (
            <>
              <Text style={styles.rowActor}>{actorName}</Text>{" "}
              {notificationPhrase(notification)}
            </>
          )}
          <Text style={styles.rowTime}> {formatTimeAgo(notification.created_at)}</Text>
        </Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

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
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  const handlePress = useCallback(
    (notification: NotificationWithActor) => {
      if (!notification.is_read) {
        readMutation.mutate(notification.id);
      }
      // Only the destinations with a mobile screen navigate; the other
      // types just mark read, as before.
      if (notification.type === "new_post" && notification.entity_id) {
        router.push(`/post/${notification.entity_id}`);
      } else if (
        notification.type === "event_reminder" &&
        notification.entity_id
      ) {
        router.push(`/events/${notification.entity_id}`);
      }
    },
    [readMutation, router],
  );

  const items = useMemo(
    () => buildActivityItems(data?.pages.flat() ?? []),
    [data],
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
        item.kind === "header" ? `header-${item.label}` : item.notification.id
      }
      renderItem={({ item }) =>
        item.kind === "header" ? (
          <Text style={styles.sectionHeader}>{item.label}</Text>
        ) : (
          <NotificationRow notification={item.notification} onPress={handlePress} />
        )
      }
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
