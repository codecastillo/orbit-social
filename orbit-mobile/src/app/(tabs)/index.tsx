import { Component, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { StoriesBar } from "@/components/stories-bar";
import { PostCard } from "@/components/post-card";
import { PostListSkeleton, StoriesSkeleton } from "@/components/post-skeleton";
import { Button, EmptyState } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import {
  FEED_PAGE_SIZE,
  checkUserInteractions,
  displayPostId,
  getFeedPage,
  type FeedTab,
  type Post,
} from "@/lib/queries/posts";
import { colors, spacing } from "@/lib/theme";

const FEED_TABS: { key: FeedTab; label: string }[] = [
  { key: "foryou", label: "For you" },
  { key: "following", label: "Following" },
];

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
  const [tab, setTab] = useState<FeedTab>("foryou");

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
    queryKey: ["feed", userId, tab],
    queryFn: ({ pageParam }) => getFeedPage(userId, tab, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.posts.length < FEED_PAGE_SIZE
        ? undefined
        : lastPage.posts[lastPage.posts.length - 1].created_at,
    enabled: !!userId,
  });

  const { posts, originals, reactionCounts } = useMemo(() => {
    const pages = data?.pages ?? [];
    const merged = {
      posts: pages.flatMap((p) => p.posts),
      originals: new Map(pages.flatMap((p) => [...p.originals])),
      reactionCounts: new Map(pages.flatMap((p) => [...p.reactionCounts])),
    };
    return merged;
  }, [data]);

  // Interactions are checked against the id each card acts on (the
  // original for reposts), so likes and reactions light up correctly.
  const displayIds = useMemo(() => [...new Set(posts.map(displayPostId))], [posts]);

  const { data: interactions } = useQuery({
    queryKey: ["post-interactions", userId, displayIds],
    queryFn: () => checkUserInteractions(userId, displayIds),
    enabled: !!userId && displayIds.length > 0,
  });

  const renderItem = ({ item }: { item: Post }) => {
    const displayId = displayPostId(item);
    return (
      <PostCard
        post={item}
        original={item.parent_post_id ? (originals.get(item.parent_post_id) ?? null) : null}
        currentUserId={userId}
        isLiked={interactions?.likedPostIds.has(displayId) ?? false}
        isBookmarked={interactions?.bookmarkedPostIds.has(displayId) ?? false}
        isReposted={interactions?.repostedPostIds.has(displayId) ?? false}
        userReaction={interactions?.reactions.get(displayId) ?? null}
        reactionCounts={reactionCounts.get(displayId) ?? []}
      />
    );
  };

  const tabsRow = (
    <View style={styles.tabsRow}>
      {FEED_TABS.map(({ key, label }) => {
        const active = tab === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => setTab(key)}
            style={({ pressed }) => [styles.tabButton, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
            <View style={[styles.tabIndicator, active && styles.tabIndicatorActive]} />
          </Pressable>
        );
      })}
    </View>
  );

  const header = (
    <>
      <StoriesBoundary>
        <StoriesBar />
      </StoriesBoundary>
      {tabsRow}
    </>
  );

  let body: ReactNode;
  if (isLoading) {
    body = (
      <View style={styles.fill}>
        <StoriesSkeleton />
        {tabsRow}
        <PostListSkeleton />
      </View>
    );
  } else if (error) {
    body = (
      <View style={styles.fill}>
        {header}
        <EmptyState
          title="Could not load the feed"
          description={error instanceof Error ? error.message : "Something went wrong."}
          action={<Button label="Retry" variant="outline" onPress={() => refetch()} />}
        />
      </View>
    );
  } else {
    body = (
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        initialNumToRender={8}
        windowSize={9}
        removeClippedSubviews
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
            title={tab === "following" ? "Your following feed is quiet" : "Nothing here yet"}
            description={
              tab === "following"
                ? "Posts from people you follow will show up here."
                : "Follow people or share your first post to get the feed going."
            }
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
  tabsRow: {
    flexDirection: "row",
    gap: spacing(5),
    paddingHorizontal: spacing(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tabButton: {
    alignItems: "center",
    paddingTop: spacing(2.5),
  },
  tabLabel: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  tabLabelActive: {
    color: colors.foreground,
  },
  tabIndicator: {
    marginTop: spacing(1.5),
    height: 2.5,
    width: 24,
    borderRadius: 1.5,
    backgroundColor: "transparent",
  },
  tabIndicatorActive: {
    backgroundColor: colors.primary,
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
