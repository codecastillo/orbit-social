import { useRef, useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/ui";
import { ReactionCounts } from "@/components/reaction-counts";
import { ReactionPicker, type ReactionAnchor } from "@/components/reaction-picker";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import {
  createRepost,
  toggleBookmark,
  toggleLike,
  undoRepost,
  type Post,
} from "@/lib/queries/posts";
import {
  addReaction,
  removeReaction,
  type ReactionCount,
  type ReactionType,
} from "@/lib/queries/reactions";
import { colors, radii, spacing } from "@/lib/theme";

const DEFAULT_MEDIA_ASPECT = 4 / 3;
const WEB_POST_URL = "https://orbitsocial.net/post";

interface PostCardProps {
  post: Post;
  currentUserId: string;
  isLiked: boolean;
  isBookmarked: boolean;
  isReposted?: boolean;
  userReaction?: ReactionType | null;
  reactionCounts?: ReactionCount[];
  // Resolved parent for repost and quote rows, batched at page level by
  // the screen query so cards never fetch on their own.
  original?: Post | null;
  // The detail screen renders the tapped post itself; disable the
  // card-wide navigation there so taps hit the action row cleanly.
  disableNavigation?: boolean;
  // Threaded reply cell: smaller avatar, left rule, tighter chrome.
  reply?: boolean;
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
        <Text style={styles.quoteContent} numberOfLines={4}>
          {post.content}
        </Text>
      ) : null}
      {media && media.type !== "video" ? (
        <Image
          source={{ uri: media.url }}
          alt="Quoted post image"
          placeholder={media.blurhash ? { blurhash: media.blurhash } : undefined}
          style={styles.quoteMedia}
          contentFit="cover"
          transition={200}
        />
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
  original = null,
  disableNavigation = false,
  reply = false,
}: PostCardProps) {
  const router = useRouter();
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
  const [reposted, setReposted] = useState(isReposted);
  const [repostCount, setRepostCount] = useState(display.repost_count);
  const [userReaction, setUserReaction] = useState(userReactionProp);
  const [reactionCounts, setReactionCounts] = useState(reactionCountsProp);
  const [pickerAnchor, setPickerAnchor] = useState<ReactionAnchor | null>(null);
  const [seed, setSeed] = useState({
    isLiked,
    isBookmarked,
    isReposted,
    likeCount: display.like_count,
    repostCount: display.repost_count,
    userReaction: userReactionProp,
    reactionCounts: reactionCountsProp,
  });

  if (
    seed.isLiked !== isLiked ||
    seed.isBookmarked !== isBookmarked ||
    seed.isReposted !== isReposted ||
    seed.likeCount !== display.like_count ||
    seed.repostCount !== display.repost_count ||
    seed.userReaction !== userReactionProp ||
    seed.reactionCounts !== reactionCountsProp
  ) {
    setSeed({
      isLiked,
      isBookmarked,
      isReposted,
      likeCount: display.like_count,
      repostCount: display.repost_count,
      userReaction: userReactionProp,
      reactionCounts: reactionCountsProp,
    });
    setLiked(isLiked);
    setLikeCount(display.like_count);
    setBookmarked(isBookmarked);
    setReposted(isReposted);
    setRepostCount(display.repost_count);
    setUserReaction(userReactionProp);
    setReactionCounts(reactionCountsProp);
  }

  const handleLike = () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((n) => Math.max(0, n + (wasLiked ? -1 : 1)));
    toggleLike(currentUserId, display.id, wasLiked).catch(() => {
      setLiked(wasLiked);
      setLikeCount((n) => Math.max(0, n + (wasLiked ? 1 : -1)));
    });
  };

  const handleBookmark = () => {
    const wasBookmarked = bookmarked;
    setBookmarked(!wasBookmarked);
    toggleBookmark(currentUserId, display.id, wasBookmarked).catch(() => {
      setBookmarked(wasBookmarked);
    });
  };

  const handleRepost = () => {
    // Reposting yourself is rejected server-side on the web too.
    if (display.user_id === currentUserId) return;
    const wasReposted = reposted;
    setReposted(!wasReposted);
    setRepostCount((n) => Math.max(0, n + (wasReposted ? -1 : 1)));
    const request = wasReposted
      ? undoRepost(currentUserId, display.id)
      : createRepost(currentUserId, display.id);
    request.catch(() => {
      setReposted(wasReposted);
      setRepostCount((n) => Math.max(0, n + (wasReposted ? 1 : -1)));
    });
  };

  const handleShare = () => {
    const url = `${WEB_POST_URL}/${display.id}`;
    Share.share(Platform.OS === "ios" ? { url } : { message: url }).catch(() => {});
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
  const openAuthor = () => router.push(`/user/${display.profiles.username}`);

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
            <Text style={styles.time}>· {formatTimeAgo(display.created_at)}</Text>
          </View>
          <Text style={styles.handle} numberOfLines={1}>
            @{display.profiles.username}
          </Text>
        </View>
      </Pressable>

      {display.content ? <Text style={styles.content}>{display.content}</Text> : null}

      {media && media.type !== "video" ? (
        <View style={[styles.mediaBox, { aspectRatio }]}>
          <Image
            source={{ uri: media.url }}
            alt="Post image"
            placeholder={media.blurhash ? { blurhash: media.blurhash } : undefined}
            style={styles.mediaImage}
            contentFit="cover"
            transition={200}
          />
        </View>
      ) : null}

      {quoted ? <QuotedPostPreview post={quoted} /> : null}

      <View style={styles.actions}>
        <Pressable onPress={openDetail} style={styles.action} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={19} color={colors.mutedForeground} />
          {display.comment_count > 0 ? (
            <Text style={styles.actionCount}>{formatNumber(display.comment_count)}</Text>
          ) : null}
        </Pressable>
        <Pressable onPress={handleRepost} style={styles.action} hitSlop={8}>
          <Ionicons
            name="repeat"
            size={20}
            color={reposted ? colors.success : colors.mutedForeground}
          />
          {repostCount > 0 ? (
            <Text style={[styles.actionCount, reposted && { color: colors.success }]}>
              {formatNumber(repostCount)}
            </Text>
          ) : null}
        </Pressable>
        <Pressable
          ref={likeButtonRef}
          onPress={handleLike}
          onLongPress={openReactionPicker}
          delayLongPress={250}
          style={styles.action}
          hitSlop={8}
        >
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={20}
            color={liked ? colors.destructive : colors.mutedForeground}
          />
          {likeCount > 0 ? <Text style={styles.actionCount}>{formatNumber(likeCount)}</Text> : null}
        </Pressable>
        <Pressable onPress={handleBookmark} style={[styles.action, styles.actionBookmark]} hitSlop={8}>
          <Ionicons
            name={bookmarked ? "bookmark" : "bookmark-outline"}
            size={19}
            color={bookmarked ? colors.primary : colors.mutedForeground}
          />
        </Pressable>
        <Pressable onPress={handleShare} style={styles.action} hitSlop={8}>
          <Ionicons name="share-outline" size={19} color={colors.mutedForeground} />
        </Pressable>
      </View>

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
        onClose={() => setPickerAnchor(null)}
      />
    </Pressable>
  );
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
  mediaBox: {
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
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing(3),
    gap: spacing(7),
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
    color: colors.mutedForeground,
    fontSize: 12.5,
    fontVariant: ["tabular-nums"],
  },
});
