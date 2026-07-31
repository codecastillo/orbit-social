import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/ui";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { toggleBookmark, toggleLike, type Post } from "@/lib/queries/posts";
import { colors, radii, spacing } from "@/lib/theme";

const DEFAULT_MEDIA_ASPECT = 4 / 3;

interface PostCardProps {
  post: Post;
  currentUserId: string;
  isLiked: boolean;
  isBookmarked: boolean;
  // The detail screen renders the tapped post itself; disable the
  // card-wide navigation there so taps hit the action row cleanly.
  disableNavigation?: boolean;
}

export function PostCard({
  post,
  currentUserId,
  isLiked,
  isBookmarked,
  disableNavigation = false,
}: PostCardProps) {
  const router = useRouter();

  // Optimistic local state, seeded from the server-derived props and
  // re-seeded during render when a refetch delivers fresh values
  // (the React "adjust state when props change" pattern).
  const [liked, setLiked] = useState(isLiked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [seed, setSeed] = useState({ isLiked, isBookmarked, likeCount: post.like_count });

  if (
    seed.isLiked !== isLiked ||
    seed.isBookmarked !== isBookmarked ||
    seed.likeCount !== post.like_count
  ) {
    setSeed({ isLiked, isBookmarked, likeCount: post.like_count });
    setLiked(isLiked);
    setLikeCount(post.like_count);
    setBookmarked(isBookmarked);
  }

  const handleLike = () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((n) => Math.max(0, n + (wasLiked ? -1 : 1)));
    toggleLike(currentUserId, post.id, wasLiked).catch(() => {
      setLiked(wasLiked);
      setLikeCount((n) => Math.max(0, n + (wasLiked ? 1 : -1)));
    });
  };

  const handleBookmark = () => {
    const wasBookmarked = bookmarked;
    setBookmarked(!wasBookmarked);
    toggleBookmark(currentUserId, post.id, wasBookmarked).catch(() => {
      setBookmarked(wasBookmarked);
    });
  };

  const openDetail = () => router.push(`/post/${post.id}`);
  const openAuthor = () => router.push(`/user/${post.profiles.username}`);

  const media = [...post.post_media].sort((a, b) => a.sort_order - b.sort_order)[0];
  const aspectRatio =
    media?.width && media?.height ? media.width / media.height : DEFAULT_MEDIA_ASPECT;

  return (
    <Pressable
      onPress={disableNavigation ? undefined : openDetail}
      style={({ pressed }) => [
        styles.card,
        pressed && !disableNavigation && { backgroundColor: colors.surface },
      ]}
    >
      <Pressable onPress={openAuthor} style={styles.authorRow} hitSlop={4}>
        <Avatar url={post.profiles.avatar_url} name={post.profiles.display_name} size={40} />
        <View style={styles.authorMeta}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName} numberOfLines={1}>
              {post.profiles.display_name}
            </Text>
            {post.profiles.is_verified ? (
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
            ) : null}
          </View>
          <Text style={styles.handle} numberOfLines={1}>
            @{post.profiles.username} · {formatTimeAgo(post.created_at)}
          </Text>
        </View>
      </Pressable>

      {post.content ? <Text style={styles.content}>{post.content}</Text> : null}

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

      <View style={styles.actions}>
        <Pressable onPress={handleLike} style={styles.action} hitSlop={8}>
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={20}
            color={liked ? colors.destructive : colors.mutedForeground}
          />
          {likeCount > 0 ? <Text style={styles.actionCount}>{formatNumber(likeCount)}</Text> : null}
        </Pressable>
        <Pressable onPress={openDetail} style={styles.action} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={19} color={colors.mutedForeground} />
          {post.comment_count > 0 ? (
            <Text style={styles.actionCount}>{formatNumber(post.comment_count)}</Text>
          ) : null}
        </Pressable>
        <Pressable onPress={handleBookmark} style={[styles.action, styles.actionLast]} hitSlop={8}>
          <Ionicons
            name={bookmarked ? "bookmark" : "bookmark-outline"}
            size={19}
            color={bookmarked ? colors.primary : colors.mutedForeground}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
    fontWeight: "600",
    flexShrink: 1,
  },
  handle: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 1,
  },
  content: {
    color: colors.foreground,
    fontSize: 15,
    lineHeight: 21,
    marginTop: spacing(2.5),
  },
  mediaBox: {
    marginTop: spacing(2.5),
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
    width: "100%",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing(3),
    gap: spacing(8),
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionLast: {
    marginLeft: "auto",
  },
  actionCount: {
    color: colors.mutedForeground,
    fontSize: 12.5,
  },
});
