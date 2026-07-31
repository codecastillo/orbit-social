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
import { Stack, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Centered, EmptyState } from "@/components/ui";
import { getBookmarkedPosts, removeBookmark } from "@/lib/queries/bookmarks";
import type { Post } from "@/lib/queries/posts";
import { formatTimeAgo } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const THUMBNAIL_SIZE = 56;

function rowThumbnail(post: Post): string | null {
  const media = [...post.post_media].sort(
    (a, b) => a.sort_order - b.sort_order,
  )[0];
  if (!media) return null;
  return media.thumbnail_url ?? media.url;
}

function rowExcerpt(post: Post): string {
  if (post.content?.trim()) return post.content.trim();
  if (post.post_media.length > 0) {
    return post.post_media[0].type === "video" ? "Video" : "Photo";
  }
  return "Post";
}

function BookmarkRow({
  post,
  onPress,
  onUnsave,
}: {
  post: Post;
  onPress: () => void;
  onUnsave: () => void;
}) {
  const thumbnail = rowThumbnail(post);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open post by ${post.profiles.display_name || post.profiles.username}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      {thumbnail ? (
        <Image
          source={{ uri: thumbnail }}
          alt=""
          style={styles.thumbnail}
          contentFit="cover"
          transition={0}
        />
      ) : null}
      <View style={styles.rowBody}>
        <View style={styles.rowMeta}>
          <Text style={styles.rowAuthor} numberOfLines={1}>
            {post.profiles.display_name || post.profiles.username}
          </Text>
          <Text style={styles.rowTime}>{formatTimeAgo(post.created_at)}</Text>
        </View>
        <Text style={styles.rowExcerpt} numberOfLines={2}>
          {rowExcerpt(post)}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove from saved"
        onPress={onUnsave}
        hitSlop={8}
        style={({ pressed }) => [styles.unsave, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="bookmark" size={20} color={colors.primary} />
      </Pressable>
    </Pressable>
  );
}

export default function BookmarksScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const bookmarksKey = ["bookmarked-posts", user?.id];

  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: bookmarksKey,
    queryFn: () => getBookmarkedPosts(user!.id),
    enabled: !!user,
  });

  const unsaveMutation = useMutation({
    mutationFn: (postId: string) => removeBookmark(user!.id, postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: bookmarksKey });
      const previous = queryClient.getQueryData<Post[]>(bookmarksKey);
      queryClient.setQueryData<Post[]>(bookmarksKey, (posts) =>
        posts?.filter((p) => p.id !== postId),
      );
      return { previous };
    },
    onError: (_error, _postId, context) => {
      queryClient.setQueryData(bookmarksKey, context?.previous);
      Alert.alert("Couldn't remove", "Check your connection and try again.");
    },
  });

  if (!user) return null;

  if (isPending) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Saved" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Saved" }} />
        <EmptyState
          title="Saved posts did not load"
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
      <Stack.Screen options={{ title: "Saved" }} />
      <FlatList
        data={data}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => (
          <BookmarkRow
            post={item}
            onPress={() => router.push(`/post/${item.id}`)}
            onUnsave={() => unsaveMutation.mutate(item.id)}
          />
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
            title="Nothing saved yet"
            description="Tap the bookmark on any post to keep it here."
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
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing(2),
  },
  rowAuthor: {
    flexShrink: 1,
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  rowTime: {
    color: colors.textFaint,
    fontSize: 12,
  },
  rowExcerpt: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
  },
  unsave: {
    padding: spacing(2),
  },
});
