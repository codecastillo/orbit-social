import { useState } from "react";
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
import {
  getBookmarkCollections,
  getSavedPosts,
  removeBookmark,
  type SavedPost,
} from "@/lib/queries/bookmarks";
import { CollectionFilter, FileSaveSheet } from "@/components/bookmark-collections";
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
  note,
  onPress,
  onUnsave,
  onFile,
}: {
  post: Post;
  note: string | null;
  onPress: () => void;
  onUnsave: () => void;
  onFile: () => void;
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
          cachePolicy="memory-disk"
          recyclingKey={thumbnail}
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
        {note ? (
          <Text style={styles.rowNote} numberOfLines={2}>
            {note}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="File this save"
        onPress={onFile}
        hitSlop={8}
        style={({ pressed }) => [styles.unsave, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="folder-outline" size={18} color={colors.mutedForeground} />
      </Pressable>
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
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [filing, setFiling] = useState<SavedPost | null>(null);
  const bookmarksKey = ["saved-posts", user?.id, collectionId];

  const collectionsQuery = useQuery({
    queryKey: ["bookmark-collections", user?.id],
    queryFn: () => getBookmarkCollections(user!.id),
    enabled: !!user,
  });

  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: bookmarksKey,
    queryFn: () => getSavedPosts(user!.id, collectionId),
    enabled: !!user,
  });

  const unsaveMutation = useMutation({
    mutationFn: (postId: string) => removeBookmark(user!.id, postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: bookmarksKey });
      const previous = queryClient.getQueryData<SavedPost[]>(bookmarksKey);
      queryClient.setQueryData<SavedPost[]>(bookmarksKey, (entries) =>
        entries?.filter((entry) => entry.post.id !== postId),
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
        keyExtractor={(entry) => entry.post.id}
        ListHeaderComponent={
          <CollectionFilter
            collections={collectionsQuery.data ?? []}
            active={collectionId}
            onChange={setCollectionId}
          />
        }
        renderItem={({ item }) => (
          <BookmarkRow
            post={item.post}
            note={item.note}
            onPress={() => router.push(`/post/${item.post.id}`)}
            onUnsave={() => unsaveMutation.mutate(item.post.id)}
            onFile={() => setFiling(item)}
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
            title={collectionId ? "Nothing in this collection" : "Nothing saved yet"}
            description={
              collectionId
                ? "File a save into it from the saved list."
                : "Tap the bookmark on any post to keep it here."
            }
          />
        }
        contentContainerStyle={data?.length === 0 ? styles.flex : undefined}
      />
      {filing ? (
        <FileSaveSheet
          visible
          saved={filing}
          collections={collectionsQuery.data ?? []}
          onClose={() => setFiling(null)}
          onDone={() => {
            setFiling(null);
            queryClient.invalidateQueries({ queryKey: ["saved-posts"] });
            queryClient.invalidateQueries({ queryKey: ["bookmark-collections"] });
          }}
        />
      ) : null}
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
  // The note is the viewer's own words, so it reads in the accent rather
  // than as more of the post's text.
  rowNote: {
    color: colors.primary,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 3,
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
