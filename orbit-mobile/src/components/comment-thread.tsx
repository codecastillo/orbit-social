import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionSheet, type ActionSheetOption } from "@/components/action-sheet";
import { ReportSheet } from "@/components/report-sheet";
import { RichText } from "@/components/rich-text";
import { Avatar } from "@/components/ui";
import {
  checkUserInteractions,
  deletePost,
  getReplies,
  pinComment,
  toggleLike,
  type Post,
} from "@/lib/queries/posts";
import { useCommentFilter } from "@/lib/hooks/use-content-safety";
import { useHideLikeCounts } from "@/lib/hooks/use-hide-like-counts";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";

const AVATAR_TOP_LEVEL = 34;
const AVATAR_NESTED = 28;

/**
 * One comment, laid out the way short-video apps lay them out: avatar on the
 * left, text and its actions in a column beside it, and the like button alone
 * on the right with its count underneath.
 *
 * Comments deliberately do not render as PostCard. A comment is not a post
 * with a smaller avatar: it has no repost, bookmark, or share, its reply
 * action belongs on this screen rather than pushing another one, and its like
 * reads better on the right than as one of five equal buttons in a row.
 */
function CommentRow({
  comment,
  currentUserId,
  isLiked,
  nested = false,
  canReply,
  canPin,
  pinned = false,
  onTogglePin,
  onReply,
  children,
}: {
  comment: Post;
  currentUserId: string;
  isLiked: boolean;
  /** A reply to a comment: smaller, and with no thread controls of its own. */
  nested?: boolean;
  canReply: boolean;
  canPin: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
  onReply: () => void;
  /** Replies expander and list, rendered under a top-level row's actions. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(isLiked);
  const [likeCount, setLikeCount] = useState(comment.like_count);
  const [seedLiked, setSeedLiked] = useState(isLiked);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const hideLikeCounts = useHideLikeCounts();
  const showLikeCount = !hideLikeCounts || comment.user_id === currentUserId;

  // Re-seed during render when a refetch delivers fresh values, the same
  // adjust-state-on-prop-change pattern PostCard uses.
  if (seedLiked !== isLiked) {
    setSeedLiked(isLiked);
    setLiked(isLiked);
  }

  const handleLike = () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((n) => Math.max(0, n + (wasLiked ? -1 : 1)));
    toggleLike(currentUserId, comment.id, wasLiked).catch(() => {
      setLiked(wasLiked);
      setLikeCount((n) => Math.max(0, n + (wasLiked ? 1 : -1)));
    });
  };

  const handleDelete = () => {
    deletePost(comment.id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["post-replies"] });
        queryClient.invalidateQueries({ queryKey: ["comment-replies"] });
      })
      .catch(() => {
        // The comment is still on screen and the list still matches the
        // server, so the failure is already visible without a toast.
      });
  };

  const menuOptions: ActionSheetOption[] =
    comment.user_id === currentUserId
      ? [
          {
            label: "Delete comment",
            icon: "trash-outline",
            destructive: true,
            onPress: handleDelete,
          },
        ]
      : [
          {
            label: "Report comment",
            icon: "flag-outline",
            destructive: true,
            onPress: () => setReportOpen(true),
          },
        ];

  const authorName = comment.profiles.display_name || comment.profiles.username;

  return (
    <View style={[styles.row, nested && styles.rowNested]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${comment.profiles.username}'s profile`}
        onPress={() => router.push(`/user/${comment.profiles.username}`)}
        hitSlop={4}
      >
        <Avatar
          url={comment.profiles.avatar_url}
          name={authorName}
          size={nested ? AVATAR_NESTED : AVATAR_TOP_LEVEL}
        />
      </Pressable>

      <View style={styles.body}>
        <Text style={styles.author} numberOfLines={1}>
          {authorName}
          {pinned ? <Text style={styles.pinnedNote}>{"  ·  Pinned"}</Text> : null}
        </Text>
        {comment.content ? (
          <RichText style={styles.text}>{comment.content}</RichText>
        ) : null}

        <View style={styles.meta}>
          <Text style={styles.time}>{formatTimeAgo(comment.created_at)}</Text>
          {canReply ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reply to ${comment.profiles.username}`}
              onPress={onReply}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.metaAction}>Reply</Text>
            </Pressable>
          ) : null}
          {canPin && onTogglePin ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={pinned ? "Unpin comment" : "Pin comment"}
              onPress={onTogglePin}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.metaAction}>{pinned ? "Unpin" : "Pin"}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Comment options"
            onPress={() => setMenuOpen(true)}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={14}
              color={colors.textFaint}
            />
          </Pressable>
        </View>

        {children}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={liked ? "Unlike comment" : "Like comment"}
        onPress={handleLike}
        hitSlop={8}
        style={({ pressed }) => [styles.likeColumn, pressed && { opacity: 0.6 }]}
      >
        <Ionicons
          name={liked ? "heart" : "heart-outline"}
          size={16}
          color={liked ? colors.primary : colors.mutedForeground}
        />
        {showLikeCount && likeCount > 0 ? (
          <Text style={styles.likeCount}>{formatNumber(likeCount)}</Text>
        ) : null}
      </Pressable>

      {menuOpen ? (
        <ActionSheet
          visible
          title="Comment"
          options={menuOptions}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}
      {reportOpen ? (
        <ReportSheet
          visible
          onClose={() => setReportOpen(false)}
          entityType="post"
          entityId={comment.id}
          reportedUserId={comment.user_id}
        />
      ) : null}
    </View>
  );
}

/**
 * A top-level comment plus its one level of nested replies. Nesting stops
 * here; replies to replies flatten into the same list, matching the web's
 * 2-level threading.
 */
export function CommentThread({
  comment,
  currentUserId,
  isLiked,
  expandSignal,
  onStartReply,
  canPin,
  canComment,
}: {
  comment: Post;
  currentUserId: string;
  isLiked: boolean;
  // Id of the comment the screen just posted a reply under, so the thread
  // opens itself and the fresh reply is visible without another tap.
  expandSignal: string | null;
  onStartReply: (comment: Post) => void;
  // Viewer owns the parent post; only they can pin a comment.
  canPin: boolean;
  // Resolved once by the screen from the post's who_can_comment, so no row
  // refetches the follow check on its own.
  canComment: boolean;
}) {
  const queryClient = useQueryClient();
  const [showReplies, setShowReplies] = useState(false);

  // Optimistic pin with rollback, re-seeded when a refetch delivers the
  // authoritative value (same pattern as the like heart).
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
        queryClient.invalidateQueries({
          queryKey: ["post-replies", comment.reply_to_id],
        });
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
    <View style={styles.thread}>
      <CommentRow
        comment={comment}
        currentUserId={currentUserId}
        isLiked={isLiked}
        canReply={canComment}
        canPin={canPin}
        pinned={pinned}
        onTogglePin={handleTogglePin}
        onReply={() => onStartReply(comment)}
      >
        {replyCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowReplies((v) => !v)}
            hitSlop={8}
            style={({ pressed }) => [styles.expander, pressed && { opacity: 0.6 }]}
          >
            <View style={styles.expanderRule} />
            <Text style={styles.expanderLabel}>
              {showReplies
                ? "Hide replies"
                : `View ${replyCount === 1 ? "1 reply" : `${formatNumber(replyCount)} replies`}`}
            </Text>
          </Pressable>
        ) : null}

        {showReplies ? (
          <View style={styles.nestedList}>
            {repliesQuery.isPending ? (
              <ActivityIndicator
                style={styles.nestedLoading}
                color={colors.primary}
              />
            ) : null}
            {repliesQuery.isSuccess && repliesQuery.data.length === 0 ? (
              <Text style={styles.nestedEmpty}>No replies yet.</Text>
            ) : null}
            {(repliesQuery.data ?? []).map((reply) => (
              <CommentRow
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                isLiked={replyInteractions?.likedPostIds.has(reply.id) ?? false}
                nested
                canReply={canComment}
                canPin={false}
                onReply={() => onStartReply(reply)}
              />
            ))}
          </View>
        ) : null}
      </CommentRow>
    </View>
  );
}

const styles = StyleSheet.create({
  thread: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: "row",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  // Nested rows sit inside a top-level row's body column, which already
  // carries the horizontal inset.
  rowNested: {
    paddingHorizontal: 0,
    paddingVertical: spacing(2),
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  author: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    fontWeight: "600",
  },
  pinnedNote: {
    color: colors.textFaint,
    fontWeight: "600",
  },
  text: {
    color: colors.foreground,
    fontSize: 14.5,
    lineHeight: 20,
    marginTop: 2,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(4),
    marginTop: spacing(1.5),
  },
  time: {
    color: colors.textFaint,
    fontSize: 12,
  },
  metaAction: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
  },
  // Aligned with the author line rather than the middle of the row, so on a
  // long comment it still reads as belonging to this one.
  likeColumn: {
    alignItems: "center",
    width: 28,
    paddingTop: 2,
  },
  likeCount: {
    color: colors.mutedForeground,
    fontSize: 11,
    marginTop: 2,
  },
  expander: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    marginTop: spacing(2.5),
  },
  expanderRule: {
    width: spacing(6),
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  expanderLabel: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
  },
  nestedList: {
    marginTop: spacing(1),
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
