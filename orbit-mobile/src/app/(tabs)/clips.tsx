import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { useEvent } from "expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import { ClipCommentsSheet } from "@/components/clip-comments-sheet";
import {
  CLIP_PAGE_SIZE,
  getClips,
  getCuratedClips,
  incrementClipLoops,
  recordClipShare,
  toggleClipLike,
  type ClipLane,
  type ClipWithAuthor,
} from "@/lib/queries/clips";
import { createRepost, toggleBookmark, undoRepost } from "@/lib/queries/posts";
import { formatNumber } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

// The clips surface is an always-dark video canvas, so the overlay uses
// literal white/scrim values instead of theme tokens.
const OVERLAY_TEXT = "#ffffff";
const OVERLAY_TEXT_DIM = "rgba(255, 255, 255, 0.65)";
const OVERLAY_SCRIM = "rgba(0, 0, 0, 0.35)";

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

const ACTION_ERROR_TTL_MS = 2500;

// Loop completions batch locally and flush at this size (or when the clip
// deactivates), keeping the RPC off the hot path of every wrap.
const LOOP_FLUSH_THRESHOLD = 5;

const LANE_LABELS: Record<ClipLane, string> = {
  all: "All",
  loops: "Loops",
};

// First clip of an app session starts muted (autoplay etiquette); after that
// every clip follows the shared mute choice. Module scope resets per launch.
let firstClipOfSession = true;
let sessionMuted = false;

function ClipItem({
  clip,
  height,
  isActive,
  userId,
  isCurated,
  showLoopChip,
}: {
  clip: ClipWithAuthor;
  height: number;
  isActive: boolean;
  userId: string;
  isCurated: boolean;
  showLoopChip: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const video =
    clip.post_media.find((m) => m.type === "video") ?? clip.post_media[0];

  const player = useVideoPlayer(video?.url ?? null, (p) => {
    p.loop = true;
    p.timeUpdateEventInterval = 0.25;
  });
  // Drives the thin progress bar along the bottom edge.
  const timeUpdate = useEvent(player, "timeUpdate");

  const duration = player.duration;
  const progress =
    duration > 0 && timeUpdate ? Math.min(1, timeUpdate.currentTime / duration) : 0;
  const [muted, setMuted] = useState(() => {
    if (firstClipOfSession) {
      firstClipOfSession = false;
      sessionMuted = true;
    }
    return sessionMuted;
  });
  const [liked, setLiked] = useState(clip.user_has_liked);
  const [likeCount, setLikeCount] = useState(clip.like_count);
  const [bookmarked, setBookmarked] = useState(clip.user_has_bookmarked);
  const [bookmarkCount, setBookmarkCount] = useState(clip.bookmark_count);
  const [shareCount, setShareCount] = useState(clip.share_count ?? 0);
  const [commentCount, setCommentCount] = useState(clip.comment_count);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [loopCount, setLoopCount] = useState(clip.loop_count);
  const [reposted, setReposted] = useState(clip.user_has_reposted);
  const [repostCount, setRepostCount] = useState(clip.repost_count);
  const [actionError, setActionError] = useState<string | null>(null);
  const actionErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLoopsRef = useRef(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  // Preloaded neighbors mount before they scroll in, so each clip re-adopts
  // the shared mute choice the moment it becomes the active one. Adjusted
  // during render (the React-endorsed pattern) rather than in an effect.
  const [wasActive, setWasActive] = useState(isActive);
  if (isActive !== wasActive) {
    setWasActive(isActive);
    if (isActive) setMuted(sessionMuted);
  }

  useEffect(() => {
    // Assigning player properties is expo-video's documented API; the
    // immutability rule cannot know the hook hands back a mutable native
    // object, so this one line opts out.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
  }, [muted, player]);

  const flushLoops = useCallback(() => {
    const loops = pendingLoopsRef.current;
    if (loops === 0) return;
    pendingLoopsRef.current = 0;
    incrementClipLoops(clip.id, loops).catch(() => {
      // Put the batch back so the next flush retries it; loops lost when the
      // item unmounts are acceptable for a best-effort counter.
      pendingLoopsRef.current += loops;
    });
  }, [clip.id]);

  useEffect(() => {
    if (!timeUpdate) return;
    const t = timeUpdate.currentTime;
    // loop=true wraps currentTime back toward zero; a backwards jump is one
    // completed loop (there is no seek UI to confuse it). Half the duration
    // keeps sub-second loops detectable.
    const wrapThreshold = duration > 0 ? Math.min(1, duration / 2) : 1;
    if (lastTimeRef.current - t > wrapThreshold) {
      pendingLoopsRef.current += 1;
      setLoopCount((n) => n + 1);
      if (pendingLoopsRef.current >= LOOP_FLUSH_THRESHOLD) flushLoops();
    }
    lastTimeRef.current = t;
  }, [timeUpdate, duration, flushLoops]);

  // Flush the remainder when the clip stops being the active one and again on
  // unmount, so short sessions still land their loops.
  useEffect(() => {
    if (!isActive) flushLoops();
    return flushLoops;
  }, [isActive, flushLoops]);

  useEffect(() => {
    return () => {
      if (actionErrorTimer.current) clearTimeout(actionErrorTimer.current);
    };
  }, []);

  const flashActionError = (message: string) => {
    setActionError(message);
    if (actionErrorTimer.current) clearTimeout(actionErrorTimer.current);
    actionErrorTimer.current = setTimeout(
      () => setActionError(null),
      ACTION_ERROR_TTL_MS,
    );
  };

  const likeMutation = useMutation({
    mutationFn: (wasLiked: boolean) => toggleClipLike(userId, clip.id, wasLiked),
    onError: (_err, wasLiked) => {
      // Roll the optimistic flip back.
      setLiked(wasLiked);
      setLikeCount((n) => (wasLiked ? n + 1 : n - 1));
    },
  });

  const handleLike = () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((n) => (wasLiked ? n - 1 : n + 1));
    likeMutation.mutate(wasLiked);
  };

  const handleToggleMute = () => {
    setMuted((m) => {
      sessionMuted = !m;
      return !m;
    });
  };

  const handleBookmark = () => {
    const was = bookmarked;
    setBookmarked(!was);
    setBookmarkCount((n) => (was ? n - 1 : n + 1));
    toggleBookmark(userId, clip.id, was).catch(() => {
      setBookmarked(was);
      setBookmarkCount((n) => (was ? n + 1 : n - 1));
    });
  };

  // Loop It is the clips name for a repost; same semantics as post-card.
  const handleLoopIt = () => {
    if (clip.user_id === userId) {
      flashActionError("You can't loop your own clip.");
      return;
    }
    const wasReposted = reposted;
    setReposted(!wasReposted);
    setRepostCount((n) => Math.max(0, n + (wasReposted ? -1 : 1)));
    const request = wasReposted
      ? undoRepost(userId, clip.id)
      : createRepost(userId, clip.id);
    request.catch((err: unknown) => {
      if (!wasReposted && err instanceof Error && err.message === "Already reposted") {
        // The server already holds this repost (stale interactions data);
        // keep the active state but drop the double-counted bump.
        setRepostCount((n) => Math.max(0, n - 1));
        return;
      }
      setReposted(wasReposted);
      setRepostCount((n) => Math.max(0, n + (wasReposted ? 1 : -1)));
      flashActionError(
        wasReposted ? "Could not undo the loop." : "Loop failed. Try again.",
      );
    });
  };

  const handleShare = () => {
    setShareCount((n) => n + 1);
    recordClipShare(clip.id).catch(() => {});
    Share.share({ url: `https://orbitsocial.net/clips/${clip.id}` }).catch(() => {});
  };

  const authorName = clip.profiles.display_name || clip.profiles.username;

  return (
    <View style={[styles.page, { height }]}>
      {video ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={muted ? "Unmute clip" : "Mute clip"}
          style={StyleSheet.absoluteFill}
          onPress={handleToggleMute}
        >
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
        </Pressable>
      ) : (
        <Centered>
          <Text style={{ color: colors.mutedForeground }}>
            This clip has no video.
          </Text>
        </Centered>
      )}

      {muted ? (
        <View style={[styles.muteBadge, { top: insets.top + spacing(3) }]}>
          <Ionicons name="volume-mute" size={16} color={OVERLAY_TEXT} />
        </View>
      ) : null}

      {isCurated || showLoopChip ? (
        <View
          style={[styles.chipRow, { top: insets.top + spacing(14) }]}
          pointerEvents="none"
        >
          {isCurated ? (
            <View style={styles.bestLoopsChip}>
              <View style={styles.bestLoopsDot} />
              <Text style={styles.bestLoopsChipText}>BEST LOOPS</Text>
            </View>
          ) : null}
          {showLoopChip ? (
            <View style={styles.loopChip}>
              <Text style={styles.loopChipText}>LOOP</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.overlay, { paddingBottom: spacing(4) }]}>
        <View style={styles.meta}>
          {actionError ? (
            <Text style={styles.actionErrorText}>{actionError}</Text>
          ) : null}
          <View style={styles.loopMetric}>
            <Ionicons name="repeat" size={16} color={colors.primary} />
            <Text style={styles.loopMetricText}>
              {formatNumber(loopCount)} {loopCount === 1 ? "loop" : "loops"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${authorName}'s profile`}
            onPress={() => router.push(`/user/${clip.profiles.username}` as never)}
            style={({ pressed }) => [styles.authorRow, pressed && { opacity: 0.8 }]}
          >
            <Avatar url={clip.profiles.avatar_url} name={authorName} size={34} />
            <Text style={styles.authorName} numberOfLines={1}>
              {authorName}
            </Text>
          </Pressable>
          {clip.content ? (
            <Text style={styles.caption} numberOfLines={3}>
              {clip.content}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={liked ? "Unlike clip" : "Like clip"}
            onPress={handleLike}
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={30}
              color={liked ? colors.primary : OVERLAY_TEXT}
            />
            <Text style={styles.actionCount}>{formatNumber(likeCount)}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View comments"
            onPress={() => setCommentsOpen(true)}
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="chatbubble-outline" size={28} color={OVERLAY_TEXT} />
            <Text style={styles.actionCount}>{formatNumber(commentCount)}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reposted ? "Undo loop" : "Loop it"}
            onPress={handleLoopIt}
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons
              name="repeat"
              size={30}
              color={reposted ? colors.success : OVERLAY_TEXT}
            />
            <Text style={styles.actionCount}>{formatNumber(repostCount)}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? "Remove bookmark" : "Bookmark clip"}
            onPress={handleBookmark}
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons
              name={bookmarked ? "bookmark" : "bookmark-outline"}
              size={27}
              color={OVERLAY_TEXT}
            />
            <Text style={styles.actionCount}>{formatNumber(bookmarkCount)}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share clip"
            onPress={handleShare}
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="paper-plane-outline" size={27} color={OVERLAY_TEXT} />
            <Text style={styles.actionCount}>{formatNumber(shareCount)}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.progressTrack} pointerEvents="none">
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Overlay sheet, so the clip keeps playing while comments are open. */}
      <ClipCommentsSheet
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        clipId={clip.id}
        commentCount={commentCount}
        userId={userId}
        onCountChange={(delta) => setCommentCount((n) => n + delta)}
      />
    </View>
  );
}

function LaneTabs({
  lane,
  onChange,
  top,
}: {
  lane: ClipLane;
  onChange: (lane: ClipLane) => void;
  top: number;
}) {
  return (
    <View style={[styles.laneTabs, { top }]}>
      {(["all", "loops"] as const).map((value) => {
        const active = lane === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(value)}
            style={({ pressed }) => [
              styles.laneTab,
              active && styles.laneTabActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.laneTabLabel, active && styles.laneTabLabelActive]}>
              {LANE_LABELS[value]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ClipsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pageHeight, setPageHeight] = useState(0);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [lane, setLane] = useState<ClipLane>("all");
  // Pause playback whenever the tab blurs; without this the active clip's
  // audio keeps running under every other screen.
  const isFocused = useIsFocused();

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["clips", user?.id, lane],
    queryFn: ({ pageParam }) => getClips(user!.id, pageParam, lane),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length < CLIP_PAGE_SIZE
        ? undefined
        : lastPage[lastPage.length - 1]?.created_at,
    enabled: !!user,
  });

  // Best Loops shelf; getCuratedClips degrades to [] so this never blocks or
  // breaks the feed.
  const { data: curated } = useQuery({
    queryKey: ["curated-clips", user?.id],
    queryFn: () => getCuratedClips(user!.id),
    enabled: !!user,
  });

  // Curated picks lead the All lane; the Loops lane stays a pure duration
  // filter. Deduped so a curated clip does not repeat when its page arrives.
  const curatedIds = useMemo(
    () => new Set(lane === "all" ? (curated ?? []).map((c) => c.id) : []),
    [curated, lane],
  );
  const clips = useMemo(() => {
    const pageClips = data?.pages.flat() ?? [];
    if (lane !== "all" || !curated || curated.length === 0) return pageClips;
    return [...curated, ...pageClips.filter((c) => !curatedIds.has(c.id))];
  }, [data, curated, curatedIds, lane]);

  // FlatList requires a referentially stable handler; empty deps keep it so.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visible = viewableItems.find((v) => v.isViewable);
      if (visible?.item) {
        setActiveClipId((visible.item as ClipWithAuthor).id);
      }
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: ClipWithAuthor }) => (
      <ClipItem
        clip={item}
        height={pageHeight}
        isActive={isFocused && item.id === activeClipId}
        userId={user?.id ?? ""}
        isCurated={curatedIds.has(item.id)}
        showLoopChip={lane === "loops"}
      />
    ),
    [pageHeight, activeClipId, isFocused, user?.id, curatedIds, lane],
  );

  if (!user) return null;

  return (
    <View
      style={styles.container}
      onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
    >
      {isPending || pageHeight === 0 ? (
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      ) : isError ? (
        <EmptyState
          title="Clips did not load"
          description="Check your connection and try again."
          action={<Button label="Retry" variant="outline" onPress={() => refetch()} />}
        />
      ) : clips.length === 0 ? (
        lane === "loops" ? (
          <EmptyState
            title="No loops yet"
            description="Clips that run 8 seconds or less land here."
          />
        ) : (
          <EmptyState
            title="No clips yet"
            description="When people you follow post clips, they show up here."
          />
        )
      ) : (
        <FlatList
          // Keyed per lane so switching lanes starts at the top instead of a
          // stale mid-list offset.
          key={lane}
          data={clips}
          keyExtractor={(clip) => clip.id}
          renderItem={renderItem}
          pagingEnabled
          snapToInterval={pageHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: pageHeight,
            offset: pageHeight * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={2}
          windowSize={3}
        />
      )}

      {/* Top-left so it never collides with the mute badge on the right. */}
      <View style={[styles.topLeftCluster, { top: insets.top + spacing(3) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Record a clip"
          onPress={() => router.push("/clip-camera" as Href)}
          style={({ pressed }) => [styles.topButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="camera-outline" size={18} color={OVERLAY_TEXT} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Upload a clip from your gallery"
          onPress={() => router.push("/clip-upload" as Href)}
          style={({ pressed }) => [styles.topButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="images-outline" size={18} color={OVERLAY_TEXT} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search clips"
          onPress={() => router.push("/(tabs)/discover" as never)}
          style={({ pressed }) => [styles.topButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="search" size={18} color={OVERLAY_TEXT} />
        </Pressable>
      </View>

      <LaneTabs lane={lane} onChange={setLane} top={insets.top + spacing(3)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  page: {
    width: "100%",
    backgroundColor: "#000",
  },
  muteBadge: {
    position: "absolute",
    right: spacing(4),
    backgroundColor: OVERLAY_SCRIM,
    borderRadius: 999,
    padding: spacing(2),
  },
  topLeftCluster: {
    position: "absolute",
    left: spacing(4),
    flexDirection: "row",
    gap: spacing(2),
  },
  topButton: {
    backgroundColor: OVERLAY_SCRIM,
    borderRadius: 999,
    padding: spacing(2),
  },
  laneTabs: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing(6),
  },
  laneTab: {
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(1),
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  laneTabActive: {
    borderBottomColor: colors.primary,
  },
  laneTabLabel: {
    color: OVERLAY_TEXT_DIM,
    fontSize: 14,
    fontWeight: "600",
  },
  laneTabLabelActive: {
    color: OVERLAY_TEXT,
  },
  chipRow: {
    position: "absolute",
    left: spacing(4),
    flexDirection: "row",
    gap: spacing(2),
  },
  bestLoopsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  // The satellite dot from the Orbit ring motif, riding inside the chip.
  bestLoopsDot: {
    width: 5,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.primaryForeground,
  },
  bestLoopsChipText: {
    color: colors.primaryForeground,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  loopChip: {
    backgroundColor: OVERLAY_SCRIM,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  loopChipText: {
    color: OVERLAY_TEXT,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing(4),
  },
  meta: {
    flex: 1,
    marginRight: spacing(14),
  },
  actionErrorText: {
    color: colors.destructive,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: spacing(2),
  },
  loopMetric: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    marginBottom: spacing(2),
  },
  loopMetricText: {
    color: OVERLAY_TEXT,
    fontSize: 13,
    fontWeight: "700",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
  },
  authorName: {
    color: OVERLAY_TEXT,
    fontSize: 14.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  caption: {
    color: OVERLAY_TEXT,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: spacing(2),
  },
  actions: {
    // Floating right rail above the caption block, mirroring the web layout.
    position: "absolute",
    right: spacing(2),
    bottom: spacing(28),
    alignItems: "center",
    gap: spacing(5),
  },
  actionButton: {
    alignItems: "center",
    minWidth: 44,
  },
  actionCount: {
    color: OVERLAY_TEXT,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2.5,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  progressFill: {
    height: "100%",
    backgroundColor: OVERLAY_TEXT,
  },
});
