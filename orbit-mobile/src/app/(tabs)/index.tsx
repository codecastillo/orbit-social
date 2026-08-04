import { Component, useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ClipsFeed } from "@/components/clips-feed";
import { StoriesBar } from "@/components/stories-bar";
import { PostCard } from "@/components/post-card";
import { PostListSkeleton, StoriesSkeleton } from "@/components/post-skeleton";
import { Button, EmptyState } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import {
  checkUserInteractions,
  displayPostId,
  getFeedPage,
  type FeedTab,
  type Post,
} from "@/lib/queries/posts";
import { buildMutedWordMatcher } from "@/lib/queries/content-safety";
import {
  useMutedIds,
  useMutedWords,
  useNotInterestedIds,
} from "@/lib/hooks/use-content-safety";
import { colors, spacing } from "@/lib/theme";

// Clips is a lane here, not a feed query: selecting it swaps the whole
// content area for the clips pager instead of changing the feed fetch.
type HomeLane = FeedTab | "clips";

const HOME_TABS: { key: HomeLane; label: string }[] = [
  { key: "foryou", label: "For you" },
  { key: "following", label: "Following" },
  { key: "clips", label: "Clips" },
];

// Clearance the clips pager leaves for the lane tabs overlaid on the video;
// its own All/Loops segment starts directly below this.
const CLIPS_LANE_TABS_HEIGHT = 40;

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
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const userId = user?.id ?? "";
  const [lane, setLane] = useState<HomeLane>("foryou");
  // The feed keeps its last For you/Following selection while Clips is up,
  // so coming back lands exactly where the user left off.
  const [feedTab, setFeedTab] = useState<FeedTab>("foryou");
  // The clips pager mounts on first visit and then stays mounted (hidden)
  // so its scroll position and players survive lane switches.
  const [clipsMounted, setClipsMounted] = useState(false);

  // The Orbit app header would stack on top of the floating lane row, so the
  // Clips lane runs full-bleed. The focus-effect cleanup restores the header
  // on every exit path: lane change, screen blur, and unmount.
  const clipsLaneUp = lane === "clips";
  useFocusEffect(
    useCallback(() => {
      if (!clipsLaneUp) return;
      navigation.setOptions({ headerShown: false });
      return () => navigation.setOptions({ headerShown: true });
    }, [clipsLaneUp, navigation]),
  );

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
    queryKey: ["feed", userId, feedTab],
    queryFn: ({ pageParam }) => getFeedPage(userId, feedTab, pageParam),
    initialPageParam: undefined as string | undefined,
    // The page's chronological cursor, captured before For You ranking
    // reorders posts; the last ranked item is no longer the oldest.
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!userId,
  });

  const { data: mutedWords } = useMutedWords();
  const { data: mutedIds } = useMutedIds();
  const { data: notInterestedIds } = useNotInterestedIds();

  const { posts, originals, reactionCounts } = useMemo(() => {
    const pages = data?.pages ?? [];
    // Content-safety filtering happens after the fetch so pagination
    // cursors stay a clean created_at walk. Feedback on a repost row
    // targets the original it displays, hence displayPostId. A muted
    // account drops out of the feed; their profile stays visible.
    const matchesMutedWord = buildMutedWordMatcher(mutedWords ?? []);
    const merged = {
      posts: pages
        .flatMap((p) => p.posts)
        .filter(
          (post) =>
            !notInterestedIds?.has(displayPostId(post)) &&
            !mutedIds?.has(post.user_id) &&
            !matchesMutedWord(post.content),
        ),
      originals: new Map(pages.flatMap((p) => [...p.originals])),
      reactionCounts: new Map(pages.flatMap((p) => [...p.reactionCounts])),
    };
    return merged;
  }, [data, mutedWords, mutedIds, notInterestedIds]);

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
      {HOME_TABS.map(({ key, label }) => {
        const active = lane === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              setLane(key);
              if (key === "clips") {
                setClipsMounted(true);
              } else {
                setFeedTab(key);
              }
            }}
            style={({ pressed }) => [styles.tabButton, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
            <View style={[styles.tabIndicator, active && styles.tabIndicatorActive]} />
          </Pressable>
        );
      })}
    </View>
  );

  // Compact TikTok-style variant of the lane row for the clips layer: white
  // text tabs centered over the video, violet underline on the active one.
  const clipsTabsRow = (
    <View style={styles.clipsTabsRow}>
      {HOME_TABS.map(({ key, label }) => {
        const active = lane === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              setLane(key);
              if (key !== "clips") setFeedTab(key);
            }}
            style={({ pressed }) => [styles.tabButton, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.clipsTabLabel, active && styles.clipsTabLabelActive]}>
              {label}
            </Text>
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
            title={feedTab === "following" ? "Your following feed is quiet" : "Nothing here yet"}
            description={
              feedTab === "following"
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
      {clipsMounted ? (
        // Covers the feed instead of replacing it, so the feed's scroll
        // offset is untouched when the user comes back from Clips. Hiding
        // (not unmounting) the layer likewise keeps the clips pager where
        // it was; ClipsFeed pauses itself via isActive.
        <View style={[styles.clipsLayer, lane !== "clips" && styles.clipsLayerHidden]}>
          <ClipsFeed
            isActive={lane === "clips"}
            topInset={insets.top + CLIPS_LANE_TABS_HEIGHT}
          />
          {/* The app header is hidden on this lane, so the lane row floats
              over the video on a scrim and doubles as the way back. */}
          <View style={[styles.clipsTabsScrim, { paddingTop: insets.top }]}>
            {clipsTabsRow}
          </View>
        </View>
      ) : null}
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
  clipsTabsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing(5),
    height: CLIPS_LANE_TABS_HEIGHT,
  },
  // The clips surface is an always-dark video canvas, so the lane labels use
  // literal white values instead of theme tokens (matching clips-feed).
  clipsTabLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  clipsTabLabelActive: {
    color: "#ffffff",
  },
  clipsLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  clipsLayerHidden: {
    display: "none",
  },
  clipsTabsScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  emptyContent: {
    flexGrow: 1,
  },
  footerLoader: {
    paddingVertical: spacing(5),
  },
});
