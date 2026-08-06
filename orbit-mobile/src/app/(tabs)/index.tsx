import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
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
  type FeedPageParam,
  type FeedTab,
  type Post,
} from "@/lib/queries/posts";
import { buildMutedWordMatcher } from "@/lib/queries/content-safety";
import {
  useMutedIds,
  useMutedWords,
  useNotInterestedIds,
} from "@/lib/hooks/use-content-safety";
import { loadFeedTab, saveFeedTab } from "@/lib/feed-tab-preference";
import { useNewPosts } from "@/lib/hooks/use-new-posts";
import {
  flushImpressions,
  recordImpression,
  type ImpressionSurface,
} from "@/lib/impressions";
import {
  getCustomFeedPage,
  getCustomFeeds,
} from "@/lib/queries/custom-feeds";
import { colors, radii, spacing } from "@/lib/theme";

// Clips is a lane here, not a feed query: selecting it swaps the whole
// content area for the clips pager instead of changing the feed fetch.
type HomeLane = FeedTab | "clips";

/** A pinned custom feed becomes a lane keyed by its id. */
type Lane = HomeLane | { customFeedId: string };

function laneKey(lane: Lane): string {
  return typeof lane === "string" ? lane : lane.customFeedId;
}

const HOME_TABS: { key: HomeLane; label: string }[] = [
  { key: "foryou", label: "For you" },
  { key: "following", label: "Following" },
  { key: "clips", label: "Clips" },
];

// Clearance the clips pager leaves for the lane tabs overlaid on the video;
// its own All/Loops segment starts directly below this.
const CLIPS_LANE_TABS_HEIGHT = 40;

// Half the card on screen for half a second counts as seen. Same numbers the
// web feed uses, so the two apps feed the same ranking the same signal.
const FEED_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 500,
};

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = user?.id ?? "";
  const [lane, setLane] = useState<Lane>("foryou");
  // The feed keeps its last For you/Following selection while Clips is up,
  // so coming back lands exactly where the user left off, and the choice is
  // restored across launches because /promises says it sticks.
  const [feedTab, setFeedTabState] = useState<FeedTab>("foryou");

  // Restores the stored choice once. Reading it before first paint would
  // mean blocking the whole feed on an AsyncStorage round trip, so For you
  // renders first and is corrected if the reader picked otherwise.
  useEffect(() => {
    let active = true;
    loadFeedTab().then((stored) => {
      if (active && stored) setFeedTabState(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const setFeedTab = (tab: FeedTab) => {
    setFeedTabState(tab);
    void saveFeedTab(tab);
  };
  // The clips pager mounts on first visit and then stays mounted (hidden)
  // so its scroll position and players survive lane switches.
  const [clipsMounted, setClipsMounted] = useState(false);
  const activeCustomFeedId = typeof lane === "object" ? lane.customFeedId : null;

  // Pinned custom feeds become extra lanes; unpinned ones are reachable from
  // the builder screen only.
  const customFeedsQuery = useQuery({
    queryKey: ["custom-feeds", userId],
    queryFn: () => getCustomFeeds(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
  const pinnedFeeds = (customFeedsQuery.data ?? []).filter((f) => f.is_pinned);

  const customFeedQuery = useInfiniteQuery({
    queryKey: ["custom-feed", activeCustomFeedId],
    queryFn: ({ pageParam }) =>
      getCustomFeedPage(activeCustomFeedId!, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!activeCustomFeedId,
  });

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
    initialPageParam: undefined as FeedPageParam | undefined,
    // Ranked pages paginate by excluding what they already delivered.
    // Chronological pages use the page's created_at cursor, captured before
    // For You ranking reorders posts; the last ranked item is not the oldest.
    getNextPageParam: (lastPage): FeedPageParam | undefined => {
      if (lastPage.nextExcludeIds) return { excludeIds: lastPage.nextExcludeIds };
      return lastPage.nextCursor ? { cursor: lastPage.nextCursor } : undefined;
    },
    enabled: !!userId,
  });

  const { data: mutedWords } = useMutedWords();
  const { data: mutedIds } = useMutedIds();
  const { data: notInterestedIds } = useNotInterestedIds();

  const { posts: feedPosts, originals, reactionCounts } = useMemo(() => {
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
      originals: new Map(pages.flatMap((p) => Object.entries(p.originals))),
      reactionCounts: new Map(
        pages.flatMap((p) => Object.entries(p.reactionCounts)),
      ),
    };
    return merged;
  }, [data, mutedWords, mutedIds, notInterestedIds]);

  const customFeedPosts = (customFeedQuery.data?.pages ?? []).flatMap(
    (page) => page.posts,
  );
  const posts = activeCustomFeedId ? customFeedPosts : feedPosts;

  // Interactions are checked against the id each card acts on (the
  // original for reposts), so likes and reactions light up correctly.
  const displayIds = useMemo(() => [...new Set(posts.map(displayPostId))], [posts]);

  const { data: interactions } = useQuery({
    queryKey: ["post-interactions", userId, displayIds],
    queryFn: () => checkUserInteractions(userId, displayIds),
    enabled: !!userId && displayIds.length > 0,
  });

  // Freshness pill. Compare against the newest post ANYWHERE in the loaded
  // pages, not the top of the list: For You is ranked, so the first card is
  // usually not the most recent one, and comparing against it would report
  // new posts on almost every check. Reading the unfiltered pages also means
  // muting someone cannot make the pill promise posts that never render.
  const listRef = useRef<FlatList<Post>>(null);
  const newestLoadedAt =
    data?.pages.reduce<string | null>((newest, page) => {
      for (const post of page.posts) {
        if (!newest || post.created_at > newest) newest = post.created_at;
      }
      return newest;
    }, null) ?? null;
  const hasNewPosts = useNewPosts(userId, feedTab, newestLoadedAt);

  const jumpToNewPosts = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    refetch();
  };

  // Impression instrumentation. FlatList rejects a viewability config or
  // handler that changes identity between renders, so both are built once and
  // the live surface is read off a ref at callback time instead.
  const impressionSurface = useRef<ImpressionSurface | null>(null);
  const visibleSince = useRef(new Map<string, { postId: string; since: number }>());

  useEffect(() => {
    // Clips is a lane over this list, not a feed tab: its pager records its
    // own impressions, and nothing under it belongs to For you or Following.
    impressionSurface.current =
      lane === "clips" || typeof lane === "object" ? null : feedTab;
  }, [lane, feedTab]);

  const handleViewableItemsChanged = useCallback(
    ({ changed }: { changed: ViewToken[] }) => {
      const surface = impressionSurface.current;
      const now = Date.now();
      for (const token of changed) {
        const post = token.item as Post | undefined;
        if (!post) continue;
        if (token.isViewable) {
          visibleSince.current.set(post.id, {
            // A repost row's exposure belongs to the post it displays, the
            // id every other action on that card already targets.
            postId: displayPostId(post),
            since: now,
          });
          continue;
        }
        const seen = visibleSince.current.get(post.id);
        if (!seen) continue;
        visibleSince.current.delete(post.id);
        if (surface) {
          recordImpression(seen.postId, surface, { dwellMs: now - seen.since });
        }
      }
    },
    [],
  );

  const [viewabilityPairs] = useState(() => [
    {
      viewabilityConfig: FEED_VIEWABILITY_CONFIG,
      onViewableItemsChanged: handleViewableItemsChanged,
    },
  ]);

  useEffect(() => {
    const openDwell = visibleSince.current;
    return () => {
      // Cards still on screen never report leaving the viewport, so close
      // them out here rather than lose the whole session's dwell.
      const surface = impressionSurface.current;
      const now = Date.now();
      if (surface) {
        for (const seen of openDwell.values()) {
          recordImpression(seen.postId, surface, { dwellMs: now - seen.since });
        }
      }
      openDwell.clear();
      void flushImpressions();
    };
  }, []);

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
        surface={feedTab}
      />
    );
  };

  const laneOptions: { key: Lane; label: string }[] = [
    ...HOME_TABS.map(({ key, label }) => ({ key: key as Lane, label })),
    ...pinnedFeeds.map((feed) => ({
      key: { customFeedId: feed.id } as Lane,
      label: feed.name,
    })),
  ];

  const tabsRow = (
    // Scrolls, because the number of lanes is now up to the reader.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabsRow}
    >
      {laneOptions.map(({ key, label }) => {
        const active = laneKey(lane) === laneKey(key);
        return (
          <Pressable
            key={laneKey(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              setLane(key);
              if (key === "clips") {
                setClipsMounted(true);
              } else if (typeof key === "string") {
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Build a feed"
        onPress={() => router.push("/custom-feed")}
        style={({ pressed }) => [styles.tabButton, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="add" size={18} color={colors.mutedForeground} />
        <View style={styles.tabIndicator} />
      </Pressable>
    </ScrollView>
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
        ref={listRef}
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        // Each card can carry media and a video player, so eight of them is
        // most of the first frame's work for rows nobody has scrolled to yet.
        initialNumToRender={4}
        windowSize={9}
        removeClippedSubviews
        viewabilityConfigCallbackPairs={viewabilityPairs}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={() => refetch()}
            tintColor={colors.mutedForeground}
          />
        }
        onEndReached={() => {
          // Each lane paginates its own query; without this the custom feed
          // would ask the main feed for more and stop at one page.
          if (activeCustomFeedId) {
            if (
              customFeedQuery.hasNextPage &&
              !customFeedQuery.isFetchingNextPage
            ) {
              customFeedQuery.fetchNextPage();
            }
          } else if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <EmptyState
            title={
              activeCustomFeedId
                ? "Nothing matches this feed yet"
                : feedTab === "following"
                  ? "Your following feed is quiet"
                  : "Nothing here yet"
            }
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
          ) : !hasNextPage && posts.length > 0 ? (
            <View style={styles.caughtUp}>
              <View style={styles.caughtUpRule} />
              <Text style={styles.caughtUpText}>You&apos;re all caught up</Text>
              <View style={styles.caughtUpRule} />
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
      {hasNewPosts && !clipsLaneUp ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show new posts"
          onPress={jumpToNewPosts}
          style={({ pressed }) => [styles.newPostsPill, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="arrow-up" size={13} color={colors.primaryForeground} />
          <Text style={styles.newPostsLabel}>New posts</Text>
        </Pressable>
      ) : null}
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
  caughtUp: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(7),
  },
  caughtUpRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  caughtUpText: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  newPostsPill: {
    position: "absolute",
    top: spacing(3),
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  newPostsLabel: {
    color: colors.primaryForeground,
    fontSize: 12.5,
    fontWeight: "700",
  },
});
