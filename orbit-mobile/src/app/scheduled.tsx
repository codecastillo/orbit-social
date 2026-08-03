import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Centered, EmptyState } from "@/components/ui";
import {
  deletePost,
  getScheduledPosts,
  type ScheduledPost,
} from "@/lib/queries/posts";
import { useAuth } from "@/providers/auth-provider";
import { colors, spacing } from "@/lib/theme";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// Same wording as the web scheduled page: absolute time plus a coarse
// countdown, flipping to Overdue once the client-side publisher is late.
function describeSchedule(iso: string): { label: string; overdue: boolean } {
  const date = new Date(iso);
  const abs = date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const diffMs = date.getTime() - Date.now();
  if (diffMs < 0) return { label: `${abs} · Overdue`, overdue: true };

  const relative =
    diffMs < HOUR_MS
      ? `in ${Math.round(diffMs / MINUTE_MS)}m`
      : diffMs < DAY_MS
        ? `in ${Math.round(diffMs / HOUR_MS)}h`
        : `in ${Math.round(diffMs / DAY_MS)}d`;
  return { label: `${abs} · ${relative}`, overdue: false };
}

function ScheduledRow({
  post,
  onDelete,
}: {
  post: ScheduledPost;
  onDelete: () => void;
}) {
  const sched = post.scheduled_at ? describeSchedule(post.scheduled_at) : null;
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <View style={styles.rowMeta}>
          <Ionicons
            name="time-outline"
            size={13}
            color={sched?.overdue ? colors.warning : colors.mutedForeground}
          />
          <Text style={[styles.rowTime, sched?.overdue && styles.rowTimeOverdue]}>
            {sched ? sched.label : "No time set"}
          </Text>
        </View>
        <Text style={styles.rowExcerpt} numberOfLines={3}>
          {post.content?.trim() || "Media only, no text"}
        </Text>
        {post.post_media.length > 0 ? (
          <Text style={styles.rowAttachments}>
            {post.post_media.length}{" "}
            {post.post_media.length === 1 ? "attachment" : "attachments"}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel scheduled post"
        onPress={onDelete}
        hitSlop={8}
        style={({ pressed }) => [styles.delete, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="trash-outline" size={20} color={colors.destructive} />
      </Pressable>
    </View>
  );
}

export default function ScheduledScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scheduledKey = ["scheduled-posts", user?.id];

  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: scheduledKey,
    queryFn: () => getScheduledPosts(user!.id),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => deletePost(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: scheduledKey });
      const previous = queryClient.getQueryData<ScheduledPost[]>(scheduledKey);
      queryClient.setQueryData<ScheduledPost[]>(scheduledKey, (posts) =>
        posts?.filter((p) => p.id !== postId),
      );
      return { previous };
    },
    onError: (_error, _postId, context) => {
      queryClient.setQueryData(scheduledKey, context?.previous);
      Alert.alert("Couldn't cancel", "Check your connection and try again.");
    },
  });

  const confirmDelete = (post: ScheduledPost) => {
    Alert.alert("Cancel this post?", "It will not publish and can't be recovered.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel post",
        style: "destructive",
        onPress: () => deleteMutation.mutate(post.id),
      },
    ]);
  };

  if (!user) return null;

  if (isPending) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Scheduled" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Scheduled" }} />
        <EmptyState
          title="Scheduled posts did not load"
          description="Check your connection and try again."
          action={
            <Button label="Retry" variant="outline" onPress={() => refetch()} />
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: "Scheduled" }} />
      <FlatList
        data={data}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => (
          <ScheduledRow post={item} onDelete={() => confirmDelete(item)} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.mutedForeground}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Nothing in the queue"
            description="Use the composer's schedule option to have posts publish automatically at a time you pick."
          />
        }
        contentContainerStyle={data?.length === 0 ? styles.flex : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rowTime: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  rowTimeOverdue: {
    color: colors.warning,
  },
  rowExcerpt: {
    marginTop: 2,
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 20,
  },
  rowAttachments: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: spacing(1),
  },
  delete: {
    padding: spacing(2),
  },
});
