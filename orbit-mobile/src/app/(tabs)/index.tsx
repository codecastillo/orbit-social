import { Component, useMemo, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { StoriesBar } from "@/components/stories-bar";
import { PostCard } from "@/components/post-card";
import { PostListSkeleton } from "@/components/post-skeleton";
import { Button, EmptyState } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import {
  FEED_PAGE_SIZE,
  checkUserInteractions,
  getFeedPosts,
  type Post,
} from "@/lib/queries/posts";
import { colors, spacing } from "@/lib/theme";

// StoriesBar is owned by another surface; a crash there should never take
// the feed down with it.
class StoriesBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function FeedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const userId = user?.id ?? "";

  const {
    data,
    error,
    refetch,
    isLoading,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed", userId],
    queryFn: ({ pageParam }) => getFeedPosts(userId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length < FEED_PAGE_SIZE ? undefined : lastPage[lastPage.length - 1].created_at,
    enabled: !!userId,
  });

  const posts = useMemo(() => data?.pages.flat() ?? [], [data]);
  const postIds = useMemo(() => posts.map((p) => p.id), [posts]);

  const { data: interactions } = useQuery({
    queryKey: ["post-interactions", userId, postIds],
    queryFn: () => checkUserInteractions(userId, postIds),
    enabled: !!userId && postIds.length > 0,
  });

  const renderItem = ({ item }: { item: Post }) => (
    <PostCard
      post={item}
      currentUserId={userId}
      isLiked={interactions?.likedPostIds.has(item.id) ?? false}
      isBookmarked={interactions?.bookmarkedPostIds.has(item.id) ?? false}
    />
  );

  const header = (
    <StoriesBoundary>
      <StoriesBar />
    </StoriesBoundary>
  );

  let body: ReactNode;
  if (isLoading) {
    body = (
      <View style={styles.fill}>
        {header}
        <PostListSkeleton />
      </View>
    );
  } else if (error) {
    body = (
      <EmptyState
        title="Could not load the feed"
        description={error instanceof Error ? error.message : "Something went wrong."}
        action={<Button label="Retry" variant="outline" onPress={() => refetch()} />}
      />
    );
  } else {
    body = (
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={() => refetch()}
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
            description="Follow people or share your first post to get the feed going."
          />
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            </View>
          ) : null
        }
        contentContainerStyle={posts.length === 0 ? styles.emptyContent : undefined}
      />
    );
  }

  return (
    <View style={styles.fill}>
      {body}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Compose a post"
        onPress={() => router.push("/compose")}
        style={({ pressed }) => [styles.composeButton, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="add" size={28} color={colors.primaryForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContent: {
    flexGrow: 1,
  },
  footerLoader: {
    paddingVertical: spacing(5),
  },
  composeButton: {
    position: "absolute",
    right: spacing(5),
    bottom: spacing(6),
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
