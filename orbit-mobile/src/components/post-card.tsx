import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { Avatar } from "@/components/ui";
import { EmojiPickerSheet } from "@/components/emoji-picker-sheet";
import { LinkPreviewCard } from "@/components/link-preview-card";
import { PollCard } from "@/components/poll-card";
import { ReactionCounts } from "@/components/reaction-counts";
import { RichText } from "@/components/rich-text";
import { ReactionPicker, type ReactionAnchor } from "@/components/reaction-picker";
import { ReportSheet } from "@/components/report-sheet";
import { ShareSheet } from "@/components/share-sheet";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { extractFirstUrl } from "@/lib/queries/link-previews";
import {
  createRepost,
  toggleBookmark,
  toggleLike,
  undoRepost,
  type Post,
  type PostMediaItem,
} from "@/lib/queries/posts";
import { promptWhoCanComment } from "@/lib/comment-controls";
import {
  addReaction,
  removeReaction,
  type ReactionCount,
  type ReactionType,
} from "@/lib/queries/reactions";
import {
  deletePost,
  pinPost,
  unpinPost,
  updateWhoCanComment,
} from "@/lib/queries/post-management";
import { stageQuoteSeed } from "@/lib/quote-seed";
import { recordAction, type ImpressionSurface } from "@/lib/impressions";
import { getRankingSignals, markNotInterested } from "@/lib/queries/content-safety";
import { useVideoFrame } from "@/lib/video-frame";
import { useHideLikeCounts } from "@/lib/hooks/use-hide-like-counts";
import { colors, radii, spacing } from "@/lib/theme";

const DEFAULT_MEDIA_ASPECT = 4 / 3;
const WEB_POST_URL = "https://orbitsocial.net/post";
const ACTION_ERROR_TTL_MS = 2500;
// updated_at trails created_at by a moment on plain inserts; only a gap
// past this marks a genuine edit, same rule as the web card.
const EDITED_GAP_MS = 60_000;

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface PostCardProps {
  post: Post;
  currentUserId: string;
  isLiked: boolean;
  isBookmarked: boolean;
  isReposted?: boolean;
  userReaction?: ReactionType | null;
  reactionCounts?: ReactionCount[];
  // Where this card is being shown, recorded alongside every action the
  // ranking signals track.
  surface: ImpressionSurface;
  // Resolved parent for repost and quote rows, batched at page level by
  // the screen query so cards never fetch on their own.
  original?: Post | null;
  // The detail screen renders the tapped post itself; disable the
  // card-wide navigation there so taps hit the action row cleanly.
  disableNavigation?: boolean;
  // Threaded reply cell: smaller avatar, left rule, tighter chrome.
  reply?: boolean;
  // Detail hero cell: larger body type plus a stats line instead of the
  // inline action counts, like IG's post detail.
  detail?: boolean;
  // Overrides the reply icon's default push to /post/[id]; the detail
  // screen uses it to focus the composer instead of stacking a duplicate
  // of its own route.
  onReplyPress?: () => void;
}

// Compact bordered preview of the post a quote embeds.
function QuotedPostPreview({ post }: { post: Post }) {
  const router = useRouter();
  const media = [...post.post_media].sort((a, b) => a.sort_order - b.sort_order)[0];

  return (
    <Pressable
      onPress={() => router.push(`/post/${post.id}`)}
      style={({ pressed }) => [styles.quoteBox, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.quoteAuthorRow}>
        <Avatar url={post.profiles.avatar_url} name={post.profiles.display_name} size={20} />
        <Text style={styles.quoteAuthorName} numberOfLines={1}>
          {post.profiles.display_name}
        </Text>
        {post.profiles.is_verified ? (
          <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
        ) : null}
        <Text style={styles.quoteTime}>· {formatTimeAgo(post.created_at)}</Text>
      </View>
      {post.content ? (
        <RichText style={styles.quoteContent} numberOfLines={4}>
          {post.content}
        </RichText>
      ) : null}
      {media && media.type !== "video" ? (
        <Image
          source={{ uri: media.url }}
          alt={media.alt_text ?? "Quoted post image"}
          placeholder={media.blurhash ? { blurhash: media.blurhash } : undefined}
          style={styles.quoteMedia}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={media.url}
        />
      ) : null}
    </Pressable>
  );
}

// In-place feed video: poster frame until the first tap, then an expo-video
// player that toggles play/pause on tap. Muted by default with an overlay
// unmute toggle, mirroring the clips lane etiquette.
function PostVideo({ media, inset }: { media: PostMediaItem; inset: boolean }) {
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  // Same fallback the clip tiles use when no cover frame was uploaded.
  const frame = useVideoFrame(media.thumbnail_url ? null : media.url);
  const poster = media.thumbnail_url ?? frame;
  const aspectRatio =
    media.width && media.height ? media.width / media.height : DEFAULT_MEDIA_ASPECT;

  const player = useVideoPlayer(media.url, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    // Assigning player properties is expo-video's documented API; the
    // immutability rule cannot know the hook hands back a mutable native
    // object, so this one line opts out.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
  }, [muted, player]);

  const handleToggle = () => {
    if (playing) {
      player.pause();
      setPlaying(false);
      return;
    }
    setStarted(true);
    setPlaying(true);
    player.play();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        playing ? "Pause video" : (media.alt_text ?? "Play video")
      }
      onPress={handleToggle}
      style={[inset ? styles.mediaInset : styles.mediaFullBleed, { aspectRatio }]}
    >
      {started ? (
        <VideoView
          player={player}
          style={styles.mediaImage}
          contentFit="cover"
          nativeControls={false}
        />
      ) : (
        <Image
          source={poster ? { uri: poster } : undefined}
          alt={media.alt_text ?? "Post video"}
          style={styles.mediaImage}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={media.url}
        />
      )}
      {!playing ? (
        <View style={styles.playOverlay} pointerEvents="none">
          <View style={styles.playCircle}>
            <Ionicons name="play" size={26} color="#fff" style={styles.playIcon} />
          </View>
        </View>
      ) : null}
      {!started && media.duration_ms ? (
        <View style={styles.durationBadge} pointerEvents="none">
          <Text style={styles.durationBadgeText}>
            {formatDuration(media.duration_ms)}
          </Text>
        </View>
      ) : null}
      {started ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={muted ? "Unmute video" : "Mute video"}
          onPress={() => setMuted((m) => !m)}
          hitSlop={8}
          style={({ pressed }) => [styles.muteToggle, pressed && { opacity: 0.7 }]}
        >
          <Ionicons
            name={muted ? "volume-mute" : "volume-high"}
            size={15}
            color="#fff"
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function PostCard({
  post,
  currentUserId,
  isLiked,
  isBookmarked,
  isReposted = false,
  userReaction: userReactionProp = null,
  reactionCounts: reactionCountsProp = [],
  surface,
  original = null,
  disableNavigation = false,
  reply = false,
  detail = false,
  onReplyPress,
}: PostCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const likeButtonRef = useRef<View>(null);

  const isRepost = post.type === "repost" && !!post.parent_post_id;
  const quoted = post.type === "quote" && post.parent_post_id ? original : null;
  // Reposts display, and act on, the original post so likes and reactions
  // land where the viewer expects instead of on the empty repost row.
  const display = isRepost && original ? original : post;

  // Optimistic local state, seeded from the server-derived props and
  // re-seeded during render when a refetch delivers fresh values
  // (the React "adjust state when props change" pattern).
  const [liked, setLiked] = useState(isLiked);
  const [likeCount, setLikeCount] = useState(display.like_count);
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [bookmarkCount, setBookmarkCount] = useState(display.bookmark_count);
  const [reposted, setReposted] = useState(isReposted);
  const [repostCount, setRepostCount] = useState(display.repost_count);
  const [userReaction, setUserReaction] = useState(userReactionProp);
  const [reactionCounts, setReactionCounts] = useState(reactionCountsProp);
  const [pickerAnchor, setPickerAnchor] = useState<ReactionAnchor | null>(null);
  const [emojiSheetOpen, setEmojiSheetOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [warningRevealed, setWarningRevealed] = useState(false);
  // Viewers who set sensitive_content_level "more" skip the reveal tap.
  // getRankingSignals is module-cached, so cards share one fetch.
  const { data: rankingSignals } = useQuery({
    queryKey: ["ranking-signals", currentUserId],
    queryFn: () => getRankingSignals(currentUserId),
    enabled: !!display.content_warning && !!currentUserId,
    staleTime: 5 * 60_000,
  });
  const contentHidden =
    !!display.content_warning &&
    !warningRevealed &&
    !(rankingSignals?.autoRevealSensitive ?? false);
  // Viewer-level setting: the number goes away on other people's posts,
  // the heart and its state never do.
  const hideLikeCounts = useHideLikeCounts();
  const showLikeCount = !hideLikeCounts || display.user_id === currentUserId;
  const [actionError, setActionError] = useState<string | null>(null);
  const actionErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seed, setSeed] = useState({
    isLiked,
    isBookmarked,
    isReposted,
    likeCount: display.like_count,
    repostCount: display.repost_count,
    bookmarkCount: display.bookmark_count,
    userReaction: userReactionProp,
    reactionCounts: reactionCountsProp,
  });

  // Re-seed each piece of optimistic state independently, only when its own
  // server truth changes. A single all-or-nothing reseed let any prop change
  // (including a referentially new but equal reactionCounts array from a
  // parent re-render) stomp unrelated optimistic state, which is why an
  // optimistic repost used to snap back to stale props.
  if (seed.isLiked !== isLiked) {
    setSeed((s) => ({ ...s, isLiked }));
    setLiked(isLiked);
  }
  if (seed.likeCount !== display.like_count) {
    setSeed((s) => ({ ...s, likeCount: display.like_count }));
    setLikeCount(display.like_count);
  }
  if (seed.isBookmarked !== isBookmarked) {
    setSeed((s) => ({ ...s, isBookmarked }));
    setBookmarked(isBookmarked);
  }
  if (seed.bookmarkCount !== display.bookmark_count) {
    setSeed((s) => ({ ...s, bookmarkCount: display.bookmark_count }));
    setBookmarkCount(display.bookmark_count);
  }
  if (seed.isReposted !== isReposted) {
    setSeed((s) => ({ ...s, isReposted }));
    setReposted(isReposted);
  }
  if (seed.repostCount !== display.repost_count) {
    setSeed((s) => ({ ...s, repostCount: display.repost_count }));
    setRepostCount(display.repost_count);
  }
  if (seed.userReaction !== userReactionProp) {
    setSeed((s) => ({ ...s, userReaction: userReactionProp }));
    setUserReaction(userReactionProp);
  }
  if (!sameReactionCounts(seed.reactionCounts, reactionCountsProp)) {
    setSeed((s) => ({ ...s, reactionCounts: reactionCountsProp }));
    setReactionCounts(reactionCountsProp);
  }

  useEffect(
    () => () => {
      if (actionErrorTimer.current) clearTimeout(actionErrorTimer.current);
    },
    [],
  );

  const flashActionError = (message: string) => {
    setActionError(message);
    if (actionErrorTimer.current) clearTimeout(actionErrorTimer.current);
    actionErrorTimer.current = setTimeout(() => setActionError(null), ACTION_ERROR_TTL_MS);
  };

  // Tap feedback: the heart pops on like, and double-tapping media likes
  // with a burst overlay, the gesture people bring from every other app.
  const [heartScale] = useState(() => new Animated.Value(1));
  const [burst] = useState(() => new Animated.Value(0));
  const lastMediaTapRef = useRef(0);

  const popHeart = () => {
    heartScale.setValue(0.6);
    Animated.spring(heartScale, {
      toValue: 1,
      friction: 3,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  const playBurst = () => {
    burst.setValue(0);
    Animated.sequence([
      Animated.spring(burst, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
      Animated.delay(250),
      Animated.timing(burst, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const handleLike = () => {
    const wasLiked = liked;
    if (!wasLiked) popHeart();
    setLiked(!wasLiked);
    setLikeCount((n) => Math.max(0, n + (wasLiked ? -1 : 1)));
    toggleLike(currentUserId, display.id, wasLiked).catch(() => {
      setLiked(wasLiked);
      setLikeCount((n) => Math.max(0, n + (wasLiked ? 1 : -1)));
    });
  };

  const handleMediaTap = () => {
    const now = Date.now();
    if (now - lastMediaTapRef.current < 300) {
      lastMediaTapRef.current = 0;
      playBurst();
      if (!liked) handleLike();
      return;
    }
    lastMediaTapRef.current = now;
  };

  const handleBookmark = () => {
    const wasBookmarked = bookmarked;
    setBookmarked(!wasBookmarked);
    setBookmarkCount((n) => Math.max(0, n + (wasBookmarked ? -1 : 1)));
    toggleBookmark(currentUserId, display.id, wasBookmarked).catch(() => {
      setBookmarked(wasBookmarked);
      setBookmarkCount((n) => Math.max(0, n + (wasBookmarked ? 1 : -1)));
    });
  };

  const handleRepost = () => {
    // Same rule as the web, but say so instead of silently ignoring the tap.
    if (display.user_id === currentUserId) {
      flashActionError("You can't repost your own post.");
      return;
    }
    const wasReposted = reposted;
    setReposted(!wasReposted);
    setRepostCount((n) => Math.max(0, n + (wasReposted ? -1 : 1)));
    const request = wasReposted
      ? undoRepost(currentUserId, display.id)
      : createRepost(currentUserId, display.id);
    request.catch((err: unknown) => {
      if (!wasReposted && err instanceof Error && err.message === "Already reposted") {
        // The server already holds this repost (stale interactions data);
        // keep the active state but drop the double-counted bump.
        setRepostCount((n) => Math.max(0, n - 1));
        return;
      }
      setReposted(wasReposted);
      setRepostCount((n) => Math.max(0, n + (wasReposted ? 1 : -1)));
      flashActionError(wasReposted ? "Could not undo the repost." : "Repost failed. Try again.");
    });
  };

  const handleQuote = () => {
    // The composer reads the seed on mount, same handoff as draft restore.
    stageQuoteSeed(display);
    router.push("/compose");
  };

  // Repost is no longer a bare toggle: the tap offers plain repost (or
  // undo) and quote, like the web's repost menu.
  const openRepostMenu = () => {
    Alert.alert("Repost", undefined, [
      {
        text: reposted ? "Undo repost" : "Repost",
        onPress: handleRepost,
      },
      { text: "Quote", onPress: handleQuote },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const postUrl = `${WEB_POST_URL}/${display.id}`;

  const handleNotInterested = () => {
    // Optimistic: the feed screen filters against this cache, so the post
    // disappears from the list immediately.
    const cacheKey = ["not-interested", currentUserId];
    const previous = queryClient.getQueryData<Set<string>>(cacheKey);
    queryClient.setQueryData<Set<string>>(
      cacheKey,
      new Set(previous).add(display.id),
    );
    markNotInterested(currentUserId, display.id)
      .then(() => {
        // Reconcile with the server list in case the optimistic set was
        // seeded before the query ever fetched.
        queryClient.invalidateQueries({ queryKey: cacheKey });
      })
      .catch(() => {
        queryClient.setQueryData(cacheKey, previous);
        Alert.alert("Couldn't save your feedback");
      });
    Alert.alert("Got it", "You'll see fewer posts like this.");
  };

  const handleDelete = () => {
    Alert.alert("Delete post?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deletePost(display.id)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ["feed"] });
              queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
              queryClient.invalidateQueries({ queryKey: ["post", display.id] });
            })
            .catch(() => flashActionError("Couldn't delete the post."));
        },
      },
    ]);
  };

  const handleTogglePin = () => {
    const request = display.is_pinned ? unpinPost(display.id) : pinPost(display.id);
    request
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
        queryClient.invalidateQueries({ queryKey: ["post", display.id] });
      })
      .catch(() => flashActionError("Couldn't update the pin."));
  };

  const handleCommentControls = () => {
    promptWhoCanComment(display.who_can_comment, (value) => {
      updateWhoCanComment(display.id, value)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["feed"] });
          queryClient.invalidateQueries({ queryKey: ["post", display.id] });
        })
        .catch(() => flashActionError("Couldn't update comment controls."));
    });
  };

  // Overflow menu via the native alert sheet, the same feedback surface
  // the rest of the app uses. Own posts get management actions; others'
  // posts carry feed feedback and reporting.
  const openOverflowMenu = () => {
    if (display.user_id === currentUserId) {
      // Same rule as the web menu: profile pins are for top-level posts
      // outside rooms; comments pin through their own reply-row action.
      const canPin = display.reply_to_id === null && !display.community_id;
      Alert.alert("Post options", undefined, [
        {
          text: "Edit post",
          onPress: () => router.push(`/edit-post?id=${display.id}` as Href),
        },
        ...(canPin
          ? [
              {
                text: display.is_pinned ? "Unpin from profile" : "Pin to profile",
                onPress: handleTogglePin,
              },
            ]
          : []),
        { text: "Comment controls", onPress: handleCommentControls },
        { text: "Delete post", style: "destructive", onPress: handleDelete },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }
    Alert.alert("Post options", undefined, [
      { text: "Not interested", onPress: handleNotInterested },
      {
        text: "Report post",
        style: "destructive",
        onPress: () => setReportOpen(true),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const applyReaction = (type: ReactionType) => {
    setPickerAnchor(null);
    const previous = userReaction;

    if (previous === type) {
      // Tapping the current reaction removes it.
      setUserReaction(null);
      setReactionCounts((prev) =>
        prev
          .map((r) => (r.reaction_type === type ? { ...r, count: r.count - 1 } : r))
          .filter((r) => r.count > 0),
      );
      removeReaction(currentUserId, display.id).catch(() => {
        setUserReaction(previous);
        setReactionCounts((prev) => bumpReaction(prev, type));
      });
      return;
    }

    setUserReaction(type);
    setReactionCounts((prev) => {
      let next = prev
        .map((r) => (r.reaction_type === previous ? { ...r, count: r.count - 1 } : r))
        .filter((r) => r.count > 0);
      next = bumpReaction(next, type);
      return next;
    });
    addReaction(currentUserId, display.id, type).catch(() => {
      setUserReaction(previous);
      setReactionCounts((prev) => {
        let next = prev
          .map((r) => (r.reaction_type === type ? { ...r, count: r.count - 1 } : r))
          .filter((r) => r.count > 0);
        if (previous) next = bumpReaction(next, previous);
        return next;
      });
    });
  };

  const openReactionPicker = () => {
    likeButtonRef.current?.measureInWindow((x, y) => {
      setPickerAnchor({ x, y });
    });
  };

  const openDetail = () => router.push(`/post/${display.id}`);
  const openAuthor = () => {
    recordAction(display.id, "profile_visit", surface);
    router.push(`/user/${display.profiles.username}`);
  };

  // A repost row whose original was deleted or hidden has nothing to show.
  if (isRepost && !original) {
    return (
      <View style={[styles.card, reply && styles.replyCard]}>
        <View style={styles.repostHeader}>
          <Ionicons name="repeat" size={14} color={colors.mutedForeground} />
          <Text style={styles.repostHeaderText} numberOfLines={1}>
            Reposted by {post.profiles.display_name}
          </Text>
        </View>
        <View style={styles.unavailableBox}>
          <Text style={styles.unavailableText}>This post is no longer available.</Text>
        </View>
      </View>
    );
  }

  const media = [...display.post_media].sort((a, b) => a.sort_order - b.sort_order)[0];
  const aspectRatio =
    media?.width && media?.height ? media.width / media.height : DEFAULT_MEDIA_ASPECT;
  const isEdited =
    !!display.updated_at &&
    new Date(display.updated_at).getTime() - new Date(display.created_at).getTime() >
      EDITED_GAP_MS;
  // Link previews derive from content at render time, only for posts that
  // carry no media of their own.
  const previewUrl =
    display.post_media.length === 0 && display.content
      ? extractFirstUrl(display.content)
      : null;

  return (
    <Pressable
      onPress={disableNavigation ? undefined : openDetail}
      style={({ pressed }) => [
        styles.card,
        reply && styles.replyCard,
        pressed && !disableNavigation && { opacity: 0.92 },
      ]}
    >
      {isRepost ? (
        <View style={styles.repostHeader}>
          <Ionicons name="repeat" size={14} color={colors.mutedForeground} />
          <Text style={styles.repostHeaderText} numberOfLines={1}>
            Reposted by {post.profiles.display_name}
          </Text>
        </View>
      ) : null}

      <Pressable onPress={openAuthor} style={styles.authorRow} hitSlop={4}>
        <Avatar
          url={display.profiles.avatar_url}
          name={display.profiles.display_name}
          size={reply ? 32 : 40}
        />
        <View style={styles.authorMeta}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName} numberOfLines={1}>
              {display.profiles.display_name}
            </Text>
            {display.profiles.is_verified ? (
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
            ) : null}
            <Text style={styles.time}>
              · {formatTimeAgo(display.created_at)}
              {isEdited ? " · Edited" : ""}
            </Text>
          </View>
          <Text style={styles.handle} numberOfLines={1}>
            @{display.profiles.username}
          </Text>
        </View>
        {currentUserId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post options"
            onPress={openOverflowMenu}
            hitSlop={8}
            style={({ pressed }) => pressed && { opacity: 0.6 }}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        ) : null}
      </Pressable>

      {display.visibility === "close_friends" ? (
        <View style={styles.closeFriendsBadge}>
          <Ionicons name="people" size={11} color={colors.success} />
          <Text style={styles.closeFriendsText}>Close Friends</Text>
        </View>
      ) : null}

      {display.who_can_comment !== "everyone" ? (
        <View style={styles.limitedCommentsRow}>
          <Ionicons
            name="chatbubble-outline"
            size={11}
            color={colors.mutedForeground}
          />
          <Text style={styles.limitedCommentsText}>Comments are limited</Text>
        </View>
      ) : null}

      {contentHidden ? (
        <View style={styles.warningBox}>
          <View style={styles.warningHeader}>
            <Ionicons name="warning-outline" size={16} color={colors.warning} />
            <Text style={styles.warningText} numberOfLines={2}>
              {display.content_warning}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show hidden content"
            onPress={() => setWarningRevealed(true)}
            style={({ pressed }) => [styles.warningShow, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="eye-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.warningShowText}>Show Content</Text>
          </Pressable>
        </View>
      ) : null}

      {!contentHidden && display.content ? (
        <RichText style={[styles.content, detail && styles.contentDetail]}>
          {display.content}
        </RichText>
      ) : null}

      {display.location ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Search posts from ${display.location}`}
          onPress={() =>
            router.push({
              pathname: "/(tabs)/discover",
              params: { q: display.location },
            } as Href)
          }
          hitSlop={4}
          style={styles.locationRow}
        >
          <Ionicons name="location-outline" size={12} color={colors.textFaint} />
          <Text style={styles.locationText} numberOfLines={1}>
            {display.location}
          </Text>
        </Pressable>
      ) : null}

      {!contentHidden && display.type === "poll" && display.poll_data ? (
        <PollCard
          postId={display.id}
          pollData={display.poll_data}
          currentUserId={currentUserId}
        />
      ) : null}

      {!contentHidden && media && media.type === "video" ? (
        <PostVideo media={media} inset={reply} />
      ) : null}

      {!contentHidden && media && media.type !== "video" ? (
        <Pressable
          onPress={handleMediaTap}
          style={[reply ? styles.mediaInset : styles.mediaFullBleed, { aspectRatio }]}
        >
          <Image
            source={{ uri: media.url }}
            alt={media.alt_text ?? "Post image"}
            accessibilityLabel={media.alt_text ?? "Post image"}
            placeholder={media.blurhash ? { blurhash: media.blurhash } : undefined}
            style={styles.mediaImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={media.url}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.burstWrap,
              {
                opacity: burst,
                transform: [
                  {
                    scale: burst.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.4, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name="heart" size={84} color={colors.primary} style={styles.burstHeart} />
          </Animated.View>
        </Pressable>
      ) : null}

      {!contentHidden && previewUrl ? (
        <View style={styles.linkPreviewWrap}>
          <LinkPreviewCard
            url={previewUrl}
            onOpen={() => recordAction(display.id, "link_click", surface)}
          />
        </View>
      ) : null}

      {quoted ? (
        <QuotedPostPreview post={quoted} />
      ) : post.type === "quote" ? (
        // parent_post_id is SET NULL when the quoted post is deleted, and
        // RLS can hide a live parent; both read as "gone" here.
        <View style={[styles.unavailableBox, styles.quoteUnavailable]}>
          <Text style={styles.unavailableText}>This post is no longer available.</Text>
        </View>
      ) : null}

      {detail ? (
        <View style={styles.statsRow}>
          <Text style={styles.statsTime}>{formatTimeAgo(display.created_at)}</Text>
          {showLikeCount && likeCount > 0 ? (
            <Text style={styles.statsTime}>
              {"· "}
              <Text style={styles.statsCount}>
                {formatNumber(likeCount)} {likeCount === 1 ? "like" : "likes"}
              </Text>
            </Text>
          ) : null}
          {repostCount > 0 ? (
            <Text style={styles.statsTime}>
              {"· "}
              <Text style={styles.statsCount}>
                {formatNumber(repostCount)} {repostCount === 1 ? "repost" : "reposts"}
              </Text>
            </Text>
          ) : null}
          {display.view_count > 0 ? (
            <Text style={styles.statsTime}>
              {"· "}
              <Text style={styles.statsCount}>
                {formatNumber(display.view_count)}{" "}
                {display.view_count === 1 ? "view" : "views"}
              </Text>
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.actions, detail && styles.actionsDetail]}>
        <Pressable
          ref={likeButtonRef}
          onPress={handleLike}
          onLongPress={openReactionPicker}
          delayLongPress={250}
          style={styles.action}
          hitSlop={8}
        >
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={22}
              color={liked ? colors.primary : colors.foreground}
            />
          </Animated.View>
          {!detail && showLikeCount && likeCount > 0 ? (
            <Text style={styles.actionCount}>{formatNumber(likeCount)}</Text>
          ) : null}
        </Pressable>
        <Pressable onPress={onReplyPress ?? openDetail} style={styles.action} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={21} color={colors.foreground} />
          {!detail && display.comment_count > 0 ? (
            <Text style={styles.actionCount}>
              {formatNumber(display.comment_count)}
            </Text>
          ) : null}
        </Pressable>
        <Pressable onPress={openRepostMenu} style={styles.action} hitSlop={8}>
          <Ionicons
            name="repeat"
            size={22}
            color={reposted ? colors.success : colors.foreground}
          />
          {!detail && repostCount > 0 ? (
            <Text style={styles.actionCount}>{formatNumber(repostCount)}</Text>
          ) : null}
        </Pressable>
        <Pressable onPress={() => setShareOpen(true)} style={styles.action} hitSlop={8}>
          <Ionicons name="share-outline" size={21} color={colors.foreground} />
        </Pressable>
        <Pressable onPress={handleBookmark} style={[styles.action, styles.actionBookmark]} hitSlop={8}>
          <Ionicons
            name={bookmarked ? "bookmark" : "bookmark-outline"}
            size={21}
            color={bookmarked ? colors.primary : colors.foreground}
          />
          {!detail && bookmarkCount > 0 ? (
            <Text style={styles.actionCount}>{formatNumber(bookmarkCount)}</Text>
          ) : null}
        </Pressable>
      </View>

      {!detail && display.comment_count > 0 ? (
        <Pressable onPress={onReplyPress ?? openDetail} hitSlop={4}>
          <Text style={styles.viewComments}>
            View {display.comment_count === 1 ? "1 reply" : `all ${formatNumber(display.comment_count)} replies`}
          </Text>
        </Pressable>
      ) : null}

      {actionError ? <Text style={styles.actionErrorText}>{actionError}</Text> : null}

      <ReactionCounts
        reactions={reactionCounts}
        userReaction={userReaction}
        onPressReaction={applyReaction}
      />

      <ReactionPicker
        visible={pickerAnchor !== null}
        anchor={pickerAnchor}
        currentReaction={userReaction}
        onSelect={applyReaction}
        onOpenEmojiSheet={() => {
          setPickerAnchor(null);
          setEmojiSheetOpen(true);
        }}
        onClose={() => setPickerAnchor(null)}
      />

      {/* Mounted on demand for the same per-card Modal cost reason as the
          report sheet below. */}
      {emojiSheetOpen ? (
        <EmojiPickerSheet
          visible
          onSelect={(emoji) => {
            setEmojiSheetOpen(false);
            applyReaction(emoji);
          }}
          onClose={() => setEmojiSheetOpen(false)}
        />
      ) : null}

      {shareOpen ? (
        <ShareSheet
          visible
          onClose={() => setShareOpen(false)}
          url={postUrl}
          postId={display.id}
          surface={surface}
        />
      ) : null}

      {/* Mounted on demand: feed lists render many cards, and an idle Modal
          per card would still cost a native host view each. */}
      {reportOpen ? (
        <ReportSheet
          visible
          onClose={() => setReportOpen(false)}
          entityType="post"
          entityId={display.id}
          reportedUserId={display.user_id}
        />
      ) : null}
    </Pressable>
  );
}

// Value comparison for the reseed check: the screens rebuild these arrays
// on every render, so reference equality would report phantom changes.
function sameReactionCounts(a: ReactionCount[], b: ReactionCount[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map(a.map((r) => [r.reaction_type, r.count]));
  return b.every((r) => counts.get(r.reaction_type) === r.count);
}

function bumpReaction(counts: ReactionCount[], type: ReactionType): ReactionCount[] {
  const existing = counts.find((r) => r.reaction_type === type);
  if (existing) {
    return counts.map((r) => (r.reaction_type === type ? { ...r, count: r.count + 1 } : r));
  }
  return [...counts, { reaction_type: type, count: 1 }];
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  replyCard: {
    marginLeft: spacing(4),
    paddingLeft: spacing(3),
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  repostHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing(2),
  },
  repostHeaderText: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  unavailableBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing(4),
    backgroundColor: colors.surface,
  },
  unavailableText: {
    color: colors.mutedForeground,
    fontSize: 13.5,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
  },
  authorMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  displayName: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "700",
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  time: {
    color: colors.mutedForeground,
    fontSize: 12.5,
  },
  handle: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 1,
  },
  content: {
    color: colors.foreground,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing(2.5),
  },
  contentDetail: {
    fontSize: 16,
    lineHeight: 23,
  },
  // Feed media runs edge to edge like IG: the negative margins cancel the
  // card's 16px inner padding, framed by 1px rules instead of a radius.
  mediaFullBleed: {
    marginTop: spacing(2.5),
    marginHorizontal: -spacing(4),
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
  },
  // Threaded reply cells keep an inset rounded frame; full bleed would
  // collide with the left thread rule.
  mediaInset: {
    marginTop: spacing(2.5),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
    width: "100%",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: spacing(3),
  },
  statsTime: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  statsCount: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  linkPreviewWrap: {
    marginTop: spacing(2.5),
  },
  quoteBox: {
    marginTop: spacing(2.5),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing(3),
  },
  quoteAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quoteAuthorName: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  quoteTime: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  quoteContent: {
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: spacing(1.5),
  },
  quoteMedia: {
    marginTop: spacing(2),
    height: 160,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
  },
  quoteUnavailable: {
    marginTop: spacing(2.5),
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing(3),
    gap: spacing(5),
  },
  actionsDetail: {
    marginTop: spacing(3),
    paddingTop: spacing(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionBookmark: {
    marginLeft: "auto",
  },
  actionCount: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  viewComments: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: spacing(1.5),
  },
  burstWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  burstHeart: {
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowRadius: 12,
  },
  actionErrorText: {
    color: colors.destructive,
    fontSize: 12,
    marginTop: spacing(2),
  },
  closeFriendsBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: spacing(1.5),
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(48, 164, 108, 0.2)",
    backgroundColor: "rgba(48, 164, 108, 0.1)",
  },
  closeFriendsText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "500",
  },
  limitedCommentsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing(1.5),
  },
  limitedCommentsText: {
    color: colors.mutedForeground,
    fontSize: 11.5,
  },
  warningBox: {
    marginTop: spacing(2),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 178, 36, 0.2)",
    backgroundColor: "rgba(255, 178, 36, 0.06)",
    padding: spacing(3),
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
  },
  warningText: {
    color: colors.warning,
    fontSize: 13.5,
    fontWeight: "500",
    flexShrink: 1,
  },
  warningShow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: spacing(2),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
  },
  warningShowText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: spacing(1.5),
  },
  locationText: {
    color: colors.textFaint,
    fontSize: 12,
    flexShrink: 1,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    // The triangle glyph sits optically left of center; nudge it back.
    marginLeft: 3,
  },
  durationBadge: {
    position: "absolute",
    right: spacing(2),
    bottom: spacing(2),
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  durationBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  muteToggle: {
    position: "absolute",
    right: spacing(2),
    bottom: spacing(2),
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
