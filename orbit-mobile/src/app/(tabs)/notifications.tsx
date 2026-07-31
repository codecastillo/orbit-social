import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import { colors, radii, spacing } from "@/lib/theme";

// Simplified from the web notification-item mapping: no post hydration on
// mobile yet, so post-shaped notifications all read as "post".
function notificationText(notification: NotificationWithActor): string {
  const name =
    notification.profiles.display_name || notification.profiles.username;
  const entity = notification.entity_type;

  switch (notification.type) {
    case "like":
      if (entity === "comment") return `${name} liked your comment`;
      return `${name} liked your post`;
    case "comment":
      if (entity === "comment") return `${name} replied to your comment`;
      return `${name} replied to your post`;
    case "quote":
      return `${name} quoted your post`;
    case "follow":
      return `${name} followed you`;
    case "mention":
      return `${name} mentioned you`;
    case "repost":
      return `${name} reposted your post`;
    case "message":
      return `${name} sent you a message`;
    case "story_reaction":
      return `${name} reacted to your story`;
    case "live_started":
      return `${name} just went live`;
    case "community_invite":
      return `${name} invited you to a room`;
    case "event_invite":
      return `${name} invited you to an event`;
    case "event_reminder":
      return "Heads up, your event starts soon";
    default:
      return `${name} interacted with you`;
  }
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
      <Avatar url={notification.profiles.avatar_url} name={actorName} size={40} />
      <View style={styles.rowBody}>
        <Text style={styles.rowText}>{notificationText(notification)}</Text>
        <Text style={styles.rowTime}>{formatTimeAgo(notification.created_at)}</Text>
      </View>
      {!notification.is_read ? <View style={styles.unreadDot} /> : null}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { user } = useAuth();
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
    },
    [readMutation],
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

  const notifications = data.pages.flat();

  return (
    <FlatList
      style={styles.list}
      data={notifications}
      keyExtractor={(n) => n.id}
      renderItem={({ item }) => (
        <NotificationRow notification={item} onPress={handlePress} />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
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
      contentContainerStyle={notifications.length === 0 ? { flex: 1 } : undefined}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  rowUnread: {
    backgroundColor: colors.surface,
  },
  rowBody: {
    flex: 1,
  },
  rowText: {
    color: colors.foreground,
    fontSize: 13.5,
    lineHeight: 19,
  },
  rowTime: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    marginTop: spacing(2),
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing(4),
  },
});
