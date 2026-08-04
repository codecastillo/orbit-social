import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button } from "@/components/ui";
import {
  createPost,
  getReplies,
  toggleLike,
  type Post,
} from "@/lib/queries/posts";
import { getOwnProfile } from "@/lib/queries/profiles";
import { useCommentFilter } from "@/lib/hooks/use-content-safety";
import { useHideLikeCounts } from "@/lib/hooks/use-hide-like-counts";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

const BACKDROP = "rgba(0, 0, 0, 0.55)";
const FADE_MS = 160;
const SLIDE_MS = 200;
const SHEET_RATIO = 0.65;
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 4;
const MAX_COMMENT_LENGTH = 500;

function ReplyRow({ reply, userId }: { reply: Post; userId: string }) {
  // getReplies carries no viewer-like flag, so hearts start unliked with the
  // stored count; the toggle is optimistic with rollback, like the clip rail.
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(reply.like_count);
  const hideLikeCounts = useHideLikeCounts();
  const showLikeCount = !hideLikeCounts || reply.user_id === userId;

  const handleLike = () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((n) => (wasLiked ? n - 1 : n + 1));
    toggleLike(userId, reply.id, wasLiked).catch(() => {
      setLiked(wasLiked);
      setLikeCount((n) => (wasLiked ? n + 1 : n - 1));
    });
  };

  const authorName = reply.profiles.display_name || reply.profiles.username;

  return (
    <View style={styles.replyRow}>
      <Avatar url={reply.profiles.avatar_url} name={authorName} size={32} />
      <View style={styles.replyBody}>
        <View style={styles.replyMeta}>
          <Text style={styles.replyAuthor} numberOfLines={1}>
            {authorName}
          </Text>
          <Text style={styles.replyTime}>{formatTimeAgo(reply.created_at)}</Text>
        </View>
        {reply.content ? (
          <Text style={styles.replyText}>{reply.content}</Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={liked ? "Unlike comment" : "Like comment"}
        onPress={handleLike}
        hitSlop={8}
        style={({ pressed }) => [styles.replyLike, pressed && { opacity: 0.7 }]}
      >
        <Ionicons
          name={liked ? "heart" : "heart-outline"}
          size={16}
          color={liked ? colors.primary : colors.mutedForeground}
        />
        {showLikeCount && likeCount > 0 ? (
          <Text style={styles.replyLikeCount}>{formatNumber(likeCount)}</Text>
        ) : null}
      </Pressable>
    </View>
  );
}

/**
 * A top-level comment plus its one level of nested replies, mirroring the
 * post-detail CommentThread compactly (PostCard is too heavy for the sheet):
 * a Reply action that targets the sheet composer, and a "View N replies"
 * lazy expander. Nesting stops at one level, same as post detail.
 */
function CommentRow({
  comment,
  userId,
  onStartReply,
  expandSignal,
}: {
  comment: Post;
  userId: string;
  onStartReply: (comment: Post) => void;
  // Id of the comment the sheet just posted a reply under, so the thread
  // opens itself and the fresh reply is visible without another tap.
  expandSignal: string | null;
}) {
  const [showReplies, setShowReplies] = useState(false);

  // Render-time adjust instead of an effect, same pattern as comment-thread.
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

  const replyCount = comment.comment_count;

  return (
    <View>
      <ReplyRow reply={comment} userId={userId} />
      <View style={styles.commentActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Reply to ${comment.profiles.username}`}
          onPress={() => onStartReply(comment)}
          hitSlop={8}
          style={({ pressed }) => [styles.replyAction, pressed && { opacity: 0.7 }]}
        >
          <Ionicons
            name="arrow-undo-outline"
            size={13}
            color={colors.mutedForeground}
          />
          <Text style={styles.replyActionLabel}>Reply</Text>
        </Pressable>
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
            <ReplyRow key={reply.id} reply={reply} userId={userId} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Comment overlay for the clips feed: the clip keeps playing underneath while
 * replies load in a slide-up panel. The backdrop fades in place and the panel
 * slides independently; Modal animationType="slide" would lift the dim layer
 * with the panel, which reads as the whole background moving.
 */
export function ClipCommentsSheet({
  visible,
  onClose,
  clipId,
  commentCount,
  userId,
  onCountChange,
}: {
  visible: boolean;
  onClose: () => void;
  clipId: string;
  commentCount: number;
  userId: string;
  onCountChange: (delta: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [fade] = useState(() => new Animated.Value(0));
  const [slide] = useState(() => new Animated.Value(height));
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [draft, setDraft] = useState("");
  // The comment being replied to, or null for a comment on the clip itself.
  const [replyTarget, setReplyTarget] = useState<Post | null>(null);
  // Last comment a reply landed under; its thread auto-opens to show it.
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvt, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const onHide = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  // The reply target dies with the sheet; a stale one would silently
  // retarget the next comment. Adjusted during render (the React-endorsed
  // pattern) rather than in the animation effect below.
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (!visible) {
      setReplyTarget(null);
      setExpandedCommentId(null);
    }
  }

  useEffect(() => {
    if (!visible) {
      // Reset both so the next open starts fully off-screen instead of
      // flashing one frame at the previous resting position.
      fade.setValue(0);
      slide.setValue(height);
      return;
    }
    slide.setValue(height);
    // Kick the animation one frame after the content mounts; starting it on
    // the mount frame makes first layout compete with the slide and drops
    // frames. Ease-out rather than a spring: a spring overshoots, which on a
    // tall panel reads as the sheet popping too high before settling.
    const raf = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: FADE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 0,
          duration: SLIDE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(raf);
  }, [visible, height, fade, slide]);

  const filterComments = useCommentFilter();

  const repliesQuery = useQuery({
    queryKey: ["clip-replies", clipId],
    queryFn: () => getReplies(clipId),
    enabled: visible,
    // Muted words and restricted authors drop out at the hook layer.
    select: filterComments,
  });

  // Viewer profile backs the optimistic reply row's avatar and name.
  const profileQuery = useQuery({
    queryKey: ["own-profile", userId],
    queryFn: () => getOwnProfile(userId),
    enabled: visible,
    staleTime: 1000 * 60 * 5,
  });

  const sendMutation = useMutation({
    mutationFn: ({ content, replyToId }: { content: string; replyToId: string }) =>
      createPost(userId, content, { replyToId }),
    onMutate: ({ content, replyToId }) => {
      // The clip's comment_count covers the whole reply subtree, so nested
      // replies bump the sheet count too.
      onCountChange(1);
      // Optimistic insert only for top-level comments; a nested reply lands
      // via invalidation since its thread list may not be mounted yet.
      if (replyToId !== clipId) return { tempId: null };
      const profile = profileQuery.data;
      const tempId = `pending-${Date.now()}`;
      const optimistic: Post = {
        id: tempId,
        user_id: userId,
        content,
        type: "text",
        parent_post_id: null,
        reply_to_id: clipId,
        community_id: null,
        like_count: 0,
        comment_count: 0,
        repost_count: 0,
        bookmark_count: 0,
        view_count: 0,
        is_hidden: false,
        is_pinned: false,
        visibility: "public",
        who_can_comment: "everyone",
        poll_data: null,
        created_at: new Date().toISOString(),
        profiles: profile
          ? {
              id: profile.id,
              username: profile.username,
              display_name: profile.display_name,
              avatar_url: profile.avatar_url,
              is_verified: profile.is_verified,
            }
          : {
              id: userId,
              username: "you",
              display_name: "You",
              avatar_url: null,
              is_verified: false,
            },
        post_media: [],
      };
      queryClient.setQueryData<Post[]>(["clip-replies", clipId], (prev) => [
        ...(prev ?? []),
        optimistic,
      ]);
      return { tempId };
    },
    onSuccess: (created, vars, context) => {
      if (context.tempId) {
        queryClient.setQueryData<Post[]>(["clip-replies", clipId], (prev) =>
          (prev ?? []).map((r) => (r.id === context.tempId ? created : r)),
        );
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["comment-replies", vars.replyToId] });
      // Top-level rows carry the reply counts the expanders show.
      queryClient.invalidateQueries({ queryKey: ["clip-replies", clipId] });
      setExpandedCommentId(vars.replyToId);
    },
    onError: (_err, _vars, context) => {
      onCountChange(-1);
      if (context?.tempId) {
        queryClient.setQueryData<Post[]>(["clip-replies", clipId], (prev) =>
          (prev ?? []).filter((r) => r.id !== context.tempId),
        );
      }
    },
  });

  const handleSend = () => {
    const content = draft.trim();
    if (!content || sendMutation.isPending) return;
    setDraft("");
    sendMutation.mutate({ content, replyToId: replyTarget?.id ?? clipId });
    setReplyTarget(null);
  };

  const canSend = draft.trim().length > 0 && !sendMutation.isPending;
  const sheetHeight = Math.min(
    height * SHEET_RATIO,
    height - keyboardHeight - insets.top - spacing(10),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable
          style={styles.flex}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close comments"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            bottom: keyboardHeight,
            height: sheetHeight,
            paddingBottom: keyboardHeight > 0 ? spacing(2) : insets.bottom + spacing(2),
            transform: [{ translateY: slide }],
          },
        ]}
      >
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Comments
            {commentCount > 0 ? (
              <Text style={styles.headerCount}>  {formatNumber(commentCount)}</Text>
            ) : null}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close comments"
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {repliesQuery.isPending ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : repliesQuery.isError ? (
          <View style={styles.stateWrap}>
            <Text style={styles.stateText}>Comments did not load.</Text>
            <Button
              label="Retry"
              variant="outline"
              onPress={() => repliesQuery.refetch()}
            />
          </View>
        ) : (
          <FlatList
            data={repliesQuery.data}
            keyExtractor={(reply) => reply.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <CommentRow
                comment={item}
                userId={userId}
                expandSignal={expandedCommentId}
                onStartReply={(comment) => {
                  setReplyTarget(comment);
                  inputRef.current?.focus();
                }}
              />
            )}
            ListEmptyComponent={
              <View style={styles.stateWrap}>
                <Text style={styles.emptyTitle}>No comments yet</Text>
                <Text style={styles.stateText}>
                  Be the first to say something.
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
            style={styles.flex}
          />
        )}

        {replyTarget ? (
          <View style={styles.replyContext}>
            <Text style={styles.replyContextText} numberOfLines={1}>
              Replying to @{replyTarget.profiles.username}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel reply"
              onPress={() => setReplyTarget(null)}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="close" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.composer}>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            placeholder={
              replyTarget
                ? `Reply to @${replyTarget.profiles.username}`
                : "Add a comment"
            }
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={MAX_COMMENT_LENGTH}
            style={styles.composerInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post comment"
            accessibilityState={{ disabled: !canSend }}
            onPress={handleSend}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendButton,
              !canSend && styles.sendButtonDisabled,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="arrow-up" size={18} color={colors.primaryForeground} />
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BACKDROP,
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  handleWrap: {
    alignItems: "center",
    paddingBottom: spacing(2),
  },
  handle: {
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: HANDLE_HEIGHT / 2,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  headerCount: {
    color: colors.mutedForeground,
    fontWeight: "400",
    fontSize: 13,
  },
  listContent: {
    flexGrow: 1,
    paddingVertical: spacing(2),
  },
  replyRow: {
    flexDirection: "row",
    gap: spacing(2.5),
    paddingVertical: spacing(2.5),
  },
  replyBody: {
    flex: 1,
  },
  replyMeta: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing(2),
  },
  replyAuthor: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  replyTime: {
    color: colors.textFaint,
    fontSize: 11.5,
  },
  replyText: {
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 2,
  },
  replyLike: {
    alignItems: "center",
    paddingTop: 2,
    minWidth: 24,
  },
  replyLikeCount: {
    color: colors.mutedForeground,
    fontSize: 11,
    marginTop: 2,
  },
  // Left inset lines the actions and nested rows up with the comment's body
  // text (32px avatar + row gap).
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(4),
    paddingLeft: spacing(10.5),
    paddingBottom: spacing(2),
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
    marginLeft: spacing(10.5),
    paddingLeft: spacing(3),
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    marginBottom: spacing(2),
  },
  nestedLoading: {
    paddingVertical: spacing(2),
  },
  nestedEmpty: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    paddingVertical: spacing(2),
  },
  replyContext: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(2),
    paddingVertical: spacing(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  replyContextText: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    flexShrink: 1,
  },
  stateWrap: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2.5),
    padding: spacing(6),
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  stateText: {
    color: colors.mutedForeground,
    fontSize: 13,
    textAlign: "center",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing(2),
    paddingTop: spacing(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  composerInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 19,
    maxHeight: 96,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
});
