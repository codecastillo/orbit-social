import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { useRouter } from "expo-router";
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
import { supabase } from "@/lib/supabase";
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

// Horizontal pan claims the touch only after this much dominant dx, so the
// vertical pager keeps every ordinary swipe between clips.
const SWIPE_CLAIM_DX = 40;
const SWIPE_FAIL_DY = 30;

// Press-and-hold 2x playback only arms in the outer quarter on each side;
// the center stays inert so a resting thumb never speeds the clip up.
const EDGE_HOLD_FRACTION = 0.25;
const EDGE_HOLD_MIN_MS = 250;
const FAST_RATE = 2.0;

const LANE_LABELS: Record<ClipLane, string> = {
  all: "All",
  loops: "Loops",
};

// First clip of an app session starts muted (autoplay etiquette); after that
// every clip follows the shared mute choice. Module scope resets per launch.
let firstClipOfSession = true;
let sessionMuted = false;

// Once per clip per app session, same pattern as the post-detail screens:
// pager re-activations and refetches must not count the same viewer twice.
const viewedClipIds = new Set<string>();

function ClipItem({
  clip,
  height,
  isActive,
  userId,
  isCurated,
  showLoopChip,
  overlayTop,
}: {
  clip: ClipWithAuthor;
  height: number;
  isActive: boolean;
  userId: string;
  isCurated: boolean;
  showLoopChip: boolean;
  overlayTop: number;
}) {
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
  const [reposted, setReposted] = useState(clip.user_has_reposted);
  const [repostCount, setRepostCount] = useState(clip.repost_count);
  const [actionError, setActionError] = useState<string | null>(null);
  const actionErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLoopsRef = useRef(0);
  const lastTimeRef = useRef(0);
  // Gesture pause is user intent, separate from the pager's active/inactive
  // play control. The ref mirrors the state for the stable gesture callbacks.
  const [userPaused, setUserPaused] = useState(false);
  const userPausedRef = useRef(false);
  const [rateBoosted, setRateBoosted] = useState(false);
  const boostRef = useRef(false);
  // One pause toggle per pan; onUpdate fires continuously while dragging.
  const panPauseFiredRef = useRef(false);
  const surfaceWidthRef = useRef(0);
  const [muteGlyph, setMuteGlyph] = useState<"volume-off" | "volume-high">(
    "volume-off",
  );
  const [muteGlyphOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // The ref mirror lets the once-built gesture callbacks read the current
    // pause intent without rebuilding.
    userPausedRef.current = userPaused;
    if (isActive && !userPaused) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, userPaused, player]);

  // Preloaded neighbors mount before they scroll in, so each clip re-adopts
  // the shared mute choice the moment it becomes the active one. Adjusted
  // during render (the React-endorsed pattern) rather than in an effect.
  // A gesture pause is also dropped on the way out, so scrolling back to the
  // clip never lands on a mysteriously frozen frame.
  const [wasActive, setWasActive] = useState(isActive);
  if (isActive !== wasActive) {
    setWasActive(isActive);
    if (isActive) {
      setMuted(sessionMuted);
    } else {
      // No-op re-set when already false; React bails out of the update.
      setUserPaused(false);
    }
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
      // Loops no longer headline the overlay (views do), but the count still
      // feeds Best Loops curation and ranking, so it keeps accruing.
      pendingLoopsRef.current += 1;
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

  // Fire-and-forget view count the first time this clip becomes the active
  // page, mirroring the post-detail screens.
  useEffect(() => {
    if (!isActive || viewedClipIds.has(clip.id)) return;
    viewedClipIds.add(clip.id);
    void supabase
      .rpc("increment_post_views", { p_post_id: clip.id })
      .then(({ error }) => {
        if (error) console.warn("increment_post_views failed", error.message);
      });
  }, [isActive, clip.id]);

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

  const showMuteGlyph = useCallback(
    (nextMuted: boolean) => {
      setMuteGlyph(nextMuted ? "volume-off" : "volume-high");
      muteGlyphOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(muteGlyphOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.delay(450),
        Animated.timing(muteGlyphOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [muteGlyphOpacity],
  );

  // Only the active clip receives taps, and the active clip keeps its muted
  // state synced with sessionMuted, so the module flag is a safe read here
  // and keeps this callback referentially stable for the gesture memo.
  const handleSurfaceTap = useCallback(() => {
    if (userPausedRef.current) {
      userPausedRef.current = false;
      setUserPaused(false);
      return;
    }
    const next = !sessionMuted;
    sessionMuted = next;
    setMuted(next);
    showMuteGlyph(next);
  }, [showMuteGlyph]);

  const handleTogglePause = useCallback(() => {
    const next = !userPausedRef.current;
    userPausedRef.current = next;
    setUserPaused(next);
  }, []);

  const openAuthorProfile = useCallback(() => {
    router.push(`/user/${clip.profiles.username}` as never);
  }, [router, clip.profiles.username]);

  // Lazy useState so the gestures are built once (player, router, and the
  // handlers above are all referentially stable). Their callbacks fire only
  // during native gestures, never during render; the refs rule cannot know
  // RNGH defers them, so it is opted out here, same as clip-upload's trim
  // handles.
  // eslint-disable-next-line react-hooks/refs
  const [surfaceGesture] = useState(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      // Claim only once dx is dominant, so the FlatList pager keeps every
      // vertical swipe.
      .activeOffsetX([-SWIPE_CLAIM_DX, SWIPE_CLAIM_DX])
      .failOffsetY([-SWIPE_FAIL_DY, SWIPE_FAIL_DY])
      .onStart(() => {
        panPauseFiredRef.current = false;
      })
      .onUpdate((e) => {
        // TikTok directions: a rightward swipe toggles pause the moment the
        // pan claims, mid-drag, so even a slow slide pauses instantly (a tap
        // or another right swipe resumes). Waiting for onEnd feels laggy.
        if (!panPauseFiredRef.current && e.translationX > 0) {
          panPauseFiredRef.current = true;
          handleTogglePause();
        }
      })
      .onEnd((e) => {
        // Leftward opens the author's profile; navigation waits for the
        // gesture to finish because jumping screens mid-drag feels broken.
        if (!panPauseFiredRef.current && e.translationX < 0) {
          openAuthorProfile();
        }
      });
    const edgeHold = Gesture.LongPress()
      .runOnJS(true)
      .minDuration(EDGE_HOLD_MIN_MS)
      .onStart((e) => {
        const width = surfaceWidthRef.current;
        if (width === 0) return;
        const edge = width * EDGE_HOLD_FRACTION;
        // Center holds activate too but do nothing, which keeps them inert
        // without a positional hit-test API.
        if (e.x <= edge || e.x >= width - edge) {
          boostRef.current = true;
          setRateBoosted(true);
          player.playbackRate = FAST_RATE;
        }
      })
      .onFinalize(() => {
        if (!boostRef.current) return;
        boostRef.current = false;
        setRateBoosted(false);
        player.playbackRate = 1.0;
      });
    const tap = Gesture.Tap().runOnJS(true).onEnd((_e, success) => {
      if (success) handleSurfaceTap();
    });
    // Exclusive keeps a swipe or hold from also firing the tap; there is no
    // double-tap gesture on this surface, so the tap stays immediate.
    return Gesture.Exclusive(pan, edgeHold, tap);
  });

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
  const sound = clip.sound;

  return (
    <View style={[styles.page, { height }]}>
      {video ? (
        <GestureDetector gesture={surfaceGesture}>
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel={muted ? "Unmute clip" : "Mute clip"}
            onAccessibilityTap={handleSurfaceTap}
            style={StyleSheet.absoluteFill}
            onLayout={(e) => {
              surfaceWidthRef.current = e.nativeEvent.layout.width;
            }}
          >
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
            />
          </View>
        </GestureDetector>
      ) : (
        <Centered>
          <Text style={{ color: colors.mutedForeground }}>
            This clip has no video.
          </Text>
        </Centered>
      )}

      <Animated.View
        style={[styles.centerGlyph, { opacity: muteGlyphOpacity }]}
        pointerEvents="none"
      >
        <Ionicons name={muteGlyph} size={26} color={OVERLAY_TEXT} />
      </Animated.View>

      {userPaused ? (
        <View style={styles.centerGlyph} pointerEvents="none">
          <Ionicons name="pause" size={26} color={OVERLAY_TEXT} />
        </View>
      ) : null}

      {rateBoosted ? (
        // Same band as the chip row: centered, clear of the lane tabs above.
        <View
          style={[styles.ratePillRow, { top: overlayTop + spacing(14) }]}
          pointerEvents="none"
        >
          <View style={styles.ratePill}>
            <Text style={styles.ratePillText}>2x</Text>
          </View>
        </View>
      ) : null}

      {isCurated || showLoopChip ? (
        <View
          style={[styles.chipRow, { top: overlayTop + spacing(14) }]}
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
          <View style={styles.viewMetric}>
            <Ionicons name="eye-outline" size={16} color={colors.primary} />
            <Text style={styles.viewMetricText}>
              {formatNumber(clip.view_count)}{" "}
              {clip.view_count === 1 ? "view" : "views"}
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
          {sound ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open the sound ${sound.name}`}
              onPress={() => router.push(`/sound/${sound.id}` as never)}
              style={({ pressed }) => [styles.soundChip, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="musical-notes" size={13} color={OVERLAY_TEXT} />
              <Text style={styles.soundChipText} numberOfLines={1}>
                {sound.name}
                {sound.artist ? ` · ${sound.artist}` : ""}
              </Text>
            </Pressable>
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

export function ClipsFeed({
  isActive,
  topInset,
}: {
  // Hosts flip this off when the feed scrolls out of view (Home lane change);
  // it composes with screen focus so playback stops either way.
  isActive: boolean;
  // Overlay chrome offset from the top of the feed. Defaults to the safe-area
  // inset for the full-bleed clips route; embedded hosts pass the height of
  // whatever chrome they overlay above the pager.
  topInset?: number;
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [pageHeight, setPageHeight] = useState(0);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [lane, setLane] = useState<ClipLane>("all");
  // Pause playback whenever the screen blurs; without this the active clip's
  // audio keeps running under every other screen.
  const isFocused = useIsFocused();
  const feedActive = isFocused && isActive;
  const overlayTop = topInset ?? insets.top;

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
        isActive={feedActive && item.id === activeClipId}
        userId={user?.id ?? ""}
        isCurated={curatedIds.has(item.id)}
        showLoopChip={lane === "loops"}
        overlayTop={overlayTop}
      />
    ),
    [pageHeight, activeClipId, feedActive, user?.id, curatedIds, lane, overlayTop],
  );

  if (!user) return null;

  return (
    // GestureHandlerRootView because the app root does not provide one;
    // the per-clip GestureDetector needs it as an ancestor.
    <GestureHandlerRootView
      style={styles.container}
      onLayout={(e) => {
        // A hidden host (display: none while another Home lane is up) lays
        // out at zero; keep the last real height so the pager and scroll
        // offset survive the round trip.
        const { height } = e.nativeEvent.layout;
        if (height > 0) setPageHeight(height);
      }}
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

      {/* Slim segment directly under the host's floating lane row (or the
          safe-area edge on the standalone route), one visual block with it. */}
      <LaneTabs lane={lane} onChange={setLane} top={overlayTop + spacing(1)} />
    </GestureHandlerRootView>
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
  // Shared chrome for the transient mute glyph and the persistent pause glyph.
  centerGlyph: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -28,
    marginLeft: -28,
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  ratePillRow: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  ratePill: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 999,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  ratePillText: {
    color: OVERLAY_TEXT,
    fontSize: 12,
    fontWeight: "700",
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
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1),
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  laneTabActive: {
    borderBottomColor: colors.primary,
  },
  laneTabLabel: {
    color: OVERLAY_TEXT_DIM,
    fontSize: 12,
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
  viewMetric: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    marginBottom: spacing(2),
  },
  viewMetricText: {
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
  soundChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    marginTop: spacing(2),
    // Chip hugs its label rather than stretching across the overlay column.
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  soundChipText: {
    flexShrink: 1,
    color: OVERLAY_TEXT,
    fontSize: 12.5,
    fontWeight: "500",
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
