import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PostCard } from "@/components/post-card";
import { RichText } from "@/components/rich-text";
import { Avatar } from "@/components/ui";
import {
  checkUserInteractions,
  getReplies,
  pinComment,
  toggleLike,
  type Post,
} from "@/lib/queries/posts";
import type { ReactionCount, ReactionType } from "@/lib/queries/reactions";
import { useCommentFilter } from "@/lib/hooks/use-content-safety";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";

function NestedReply({
  reply,
  currentUserId,
  isLiked,
}: {
  reply: Post;
  currentUserId: string;
  isLiked: boolean;
}) {
  // Optimistic heart with rollback, seeded from the interactions query and
  // re-seeded during render when a refetch delivers fresh values (the same
  // adjust-state-on-prop-change pattern PostCard uses).
  const [liked, setLiked] = useState(isLiked);
  const [likeCount, setLikeCount] = useState(reply.like_count);
  const [seedLiked, setSeedLiked] = useState(isLiked);

  if (seedLiked !== isLiked) {
    setSeedLiked(isLiked);
    setLiked(isLiked);
  }

  const handleLike = () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((n) => (wasLiked ? n - 1 : n + 1));
    toggleLike(currentUserId, reply.id, wasLiked).catch(() => {
      setLiked(wasLiked);
      setLikeCount((n) => (wasLiked ? n + 1 : n - 1));
    });
  };

  const authorName = reply.profiles.display_name || reply.profiles.username;

  return (
    <View style={styles.nestedRow}>
      <Avatar url={reply.profiles.avatar_url} name={authorName} size={28} />
      <View style={styles.nestedBody}>
        <View style={styles.nestedMeta}>
          <Text style={styles.nestedAuthor} numberOfLines={1}>
            {authorName}
          </Text>
          <Text style={styles.nestedTime}>{formatTimeAgo(reply.created_at)}</Text>
        </View>
        {reply.content ? (
          <RichText style={styles.nestedText}>{reply.content}</RichText>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={liked ? "Unlike reply" : "Like reply"}
        onPress={handleLike}
        hitSlop={8}
        style={({ pressed }) => [styles.nestedLike, pressed && { opacity: 0.7 }]}
      >
        <Ionicons
          name={liked ? "heart" : "heart-outline"}
          size={15}
          color={liked ? colors.primary : colors.mutedForeground}
        />
        {likeCount > 0 ? (
          <Text style={styles.nestedLikeCount}>{formatNumber(likeCount)}</Text>
        ) : null}
      </Pressable>
    </View>
  );
}

/**
 * A top-level comment on the post detail screen plus its one level of
 * nested replies, mirroring the web CommentWithReplies: the comment renders
 * as a threaded PostCard, with a Reply action and a "View N replies"
 * expander underneath. Nesting stops here; replies to replies flatten into
 * the same list, matching the web's 2-level threading.
 */
export function CommentThread({
  comment,
  currentUserId,
  isLiked,
  isBookmarked,
  isReposted,
  userReaction,
  reactionCounts,
  expandSignal,
  onStartReply,
  canPin,
}: {
  comment: Post;
  currentUserId: string;
  isLiked: boolean;
  isBookmarked: boolean;
  isReposted: boolean;
  userReaction: ReactionType | null;
  reactionCounts: ReactionCount[];
  // Id of the comment the screen just posted a reply under, so the thread
  // opens itself and the fresh reply is visible without another tap.
  expandSignal: string | null;
  onStartReply: (comment: Post) => void;
  // Viewer owns the parent post; only they can pin a comment.
  canPin: boolean;
}) {
  const queryClient = useQueryClient();
  const [showReplies, setShowReplies] = useState(false);

  // Optimistic pin with rollback, re-seeded when a refetch delivers the
  // authoritative value (same pattern as the nested-reply heart).
  const [pinned, setPinned] = useState(comment.is_pinned);
  const [seedPinned, setSeedPinned] = useState(comment.is_pinned);
  if (seedPinned !== comment.is_pinned) {
    setSeedPinned(comment.is_pinned);
    setPinned(comment.is_pinned);
  }

  const handleTogglePin = () => {
    const wasPinned = pinned;
    setPinned(!wasPinned);
    pinComment(comment.id, !wasPinned)
      .then(() => {
        // Refetch re-sorts the list and clears any sibling pin the RPC
        // replaced.
        queryClient.invalidateQueries({ queryKey: ["post-replies", comment.reply_to_id] });
      })
      .catch(() => setPinned(wasPinned));
  };

  // Render-time adjust instead of an effect: when the screen reports a new
  // reply under this comment, the thread opens so the reply is visible.
  const [seenSignal, setSeenSignal] = useState(expandSignal);
  if (seenSignal !== expandSignal) {
    setSeenSignal(expandSignal);
    if (expandSignal === comment.id) setShowReplies(true);
  }

  const filterComments = useCommentFilter();

  const repliesQuery = useQuery({
    queryKey: ["comment-replies", comment.id],
    queryFn: () => getReplies(comment.id),
    enabled: showReplies,
    // Muted words and restricted authors drop out at the hook layer.
    select: filterComments,
  });

  // The screen-level interactions query only covers top-level comments, so
  // hearts on nested replies resolve here once the thread opens.
  const replyIds = repliesQuery.data?.map((r) => r.id) ?? [];
  const { data: replyInteractions } = useQuery({
    queryKey: ["post-interactions", currentUserId, replyIds],
    queryFn: () => checkUserInteractions(currentUserId, replyIds),
    enabled: showReplies && replyIds.length > 0,
  });

  const replyCount = comment.comment_count;

  return (
    <View>
      {pinned ? (
        <View style={styles.pinnedTag}>
          <Ionicons name="pin" size={12} color={colors.mutedForeground} />
          <Text style={styles.pinnedTagLabel}>Pinned</Text>
        </View>
      ) : null}
      <PostCard
        post={comment}
        currentUserId={currentUserId}
        isLiked={isLiked}
        isBookmarked={isBookmarked}
        isReposted={isReposted}
        userReaction={userReaction}
        reactionCounts={reactionCounts}
        reply
      />
      <View style={styles.threadActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Reply to ${comment.profiles.username}`}
          onPress={() => onStartReply(comment)}
          hitSlop={8}
          style={({ pressed }) => [styles.replyAction, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="arrow-undo-outline" size={13} color={colors.mutedForeground} />
          <Text style={styles.replyActionLabel}>Reply</Text>
        </Pressable>
        {canPin ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pinned ? "Unpin comment" : "Pin comment"}
            onPress={handleTogglePin}
            hitSlop={8}
            style={({ pressed }) => [styles.replyAction, pressed && { opacity: 0.7 }]}
          >
            <Ionicons
              name={pinned ? "pin" : "pin-outline"}
              size={13}
              color={colors.mutedForeground}
            />
            <Text style={styles.replyActionLabel}>{pinned ? "Unpin" : "Pin"}</Text>
          </Pressable>
        ) : null}
        {replyCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowReplies((v) => !v)}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.viewReplies}>
              {showReplies
                ? "Hide replies"
                : `View ${replyCount === 1 ? "1 reply" : `${formatNumber(replyCount)} replies`}`}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {showReplies ? (
        <View style={styles.nestedList}>
          {repliesQuery.isPending ? (
            <ActivityIndicator style={styles.nestedLoading} color={colors.primary} />
          ) : null}
          {repliesQuery.isSuccess && repliesQuery.data.length === 0 ? (
            <Text style={styles.nestedEmpty}>No replies yet.</Text>
          ) : null}
          {(repliesQuery.data ?? []).map((reply) => (
            <NestedReply
              key={reply.id}
              reply={reply}
              currentUserId={currentUserId}
              isLiked={replyInteractions?.likedPostIds.has(reply.id) ?? false}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Matches the reply card's body-text inset so the tag sits above the
  // comment's author line.
  pinnedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
    paddingLeft: spacing(17),
    paddingTop: spacing(2),
    marginBottom: -spacing(1),
  },
  pinnedTagLabel: {
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: "600",
  },
  // Left inset lines the actions and nested rows up with the reply card's
  // body text (card inset + thread rule + 32px avatar + gap).
  threadActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(4),
    paddingLeft: spacing(17),
    paddingRight: spacing(4),
    paddingVertical: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  replyAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
  },
  replyActionLabel: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
  },
  viewReplies: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  nestedList: {
    marginLeft: spacing(12),
    paddingLeft: spacing(3),
    paddingRight: spacing(4),
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing(2),
  },
  nestedRow: {
    flexDirection: "row",
    gap: spacing(2.5),
    paddingVertical: spacing(2),
  },
  nestedBody: {
    flex: 1,
  },
  nestedMeta: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing(2),
  },
  nestedAuthor: {
    color: colors.foreground,
    fontSize: 12.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  nestedTime: {
    color: colors.textFaint,
    fontSize: 11,
  },
  nestedText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  nestedLike: {
    alignItems: "center",
    paddingTop: 2,
    minWidth: 24,
  },
  nestedLikeCount: {
    color: colors.mutedForeground,
    fontSize: 10.5,
    marginTop: 2,
  },
  nestedLoading: {
    paddingVertical: spacing(2),
  },
  nestedEmpty: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    paddingVertical: spacing(2),
  },
});
