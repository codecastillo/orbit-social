import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CommentThread } from "@/components/comment-thread";
import {
  MentionButton,
  MentionInput,
  type MentionInputHandle,
} from "@/components/mention-input";
import { PostCard } from "@/components/post-card";
import { PostListSkeleton } from "@/components/post-skeleton";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { useCommentFilter } from "@/lib/hooks/use-content-safety";
import { checkFollowing, getOwnProfile } from "@/lib/queries/profiles";
import {
  checkUserInteractions,
  createPost,
  displayPostId,
  getPost,
  getPostsByIds,
  getReplies,
  isCommentsClosedError,
  type Post,
} from "@/lib/queries/posts";
import { getPostsReactionCounts } from "@/lib/queries/reactions";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/lib/theme";

const REPLY_MAX_LENGTH = 500;
// iOS has no "monospace" alias, so pick its built-in mono face there.
const MONO_FONT = Platform.select({ ios: "Menlo", default: "monospace" });

type CommentSort = "top" | "newest";

// Short threads read best in the order they happened; past this many
// replies the best ones matter more than the latest, so Top leads.
const TOP_SORT_MIN_COMMENTS = 6;

/** Pinned always leads; the rest follow the chosen order. */
function compareComments(a: Post, b: Post, sort: CommentSort): number {
  if (a.is_pinned !== b.is_pinned) return Number(b.is_pinned) - Number(a.is_pinned);
  if (sort === "top" && a.like_count !== b.like_count) {
    return b.like_count - a.like_count;
  }
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function CommentSortToggle({
  sort,
  onChange,
}: {
  sort: CommentSort;
  onChange: (sort: CommentSort) => void;
}) {
  return (
    <View style={styles.sortBar}>
      <Text style={styles.sortEyebrow}>Replies</Text>
      <View style={styles.sortSegments}>
        {(["top", "newest"] as const).map((value) => {
          const active = sort === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(value)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.sortSegment,
                active && styles.sortSegmentActive,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[styles.sortLabel, active && styles.sortLabelActive]}>
                {value}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Once per post per app session: remounts and refetches of the same detail
// screen must not count the same reader twice.
const viewedPostIds = new Set<string>();

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";
  const [replyText, setReplyText] = useState("");
  // The comment being replied to, or null for a reply to the post itself.
  const [replyTarget, setReplyTarget] = useState<Post | null>(null);
  // Last comment a reply landed under; its thread auto-opens to show it.
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
  const [sortChoice, setSortChoice] = useState<CommentSort | null>(null);
  const replyInputRef = useRef<MentionInputHandle>(null);

  // Own avatar for the pinned reply composer; shares the profile cache key
  // used by the profile and edit screens.
  const { data: ownProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getOwnProfile(user!.id),
    enabled: !!user,
  });

  const postQuery = useQuery({
    queryKey: ["post", id],
    queryFn: () => getPost(id),
    enabled: !!id,
  });

  const parentPostId = postQuery.data?.parent_post_id ?? null;

  // Repost and quote detail rows need their original resolved before the
  // card can render it.
  const originalQuery = useQuery({
    queryKey: ["post-original", parentPostId],
    queryFn: async () => {
      const originals = await getPostsByIds([parentPostId as string]);
      return originals.get(parentPostId as string) ?? null;
    },
    enabled: !!parentPostId,
  });

  const filterComments = useCommentFilter();

  const repliesQuery = useQuery({
    queryKey: ["post-replies", id],
    queryFn: () => getReplies(id),
    enabled: !!id,
    // Muted words and restricted authors drop out at the hook layer.
    select: filterComments,
  });

  const visibleIds = [
    ...(postQuery.data ? [displayPostId(postQuery.data)] : []),
    ...(repliesQuery.data?.map((r) => r.id) ?? []),
  ];

  const { data: interactions } = useQuery({
    queryKey: ["post-interactions", userId, visibleIds],
    queryFn: () => checkUserInteractions(userId, visibleIds),
    enabled: !!userId && visibleIds.length > 0,
  });

  const { data: reactionCounts } = useQuery({
    queryKey: ["post-reactions", visibleIds],
    queryFn: () => getPostsReactionCounts(visibleIds),
    enabled: visibleIds.length > 0,
  });

  // Fire-and-forget view count, only once the post is known to exist.
  const loadedPostId = postQuery.data?.id ?? null;
  useEffect(() => {
    if (!loadedPostId || viewedPostIds.has(loadedPostId)) return;
    viewedPostIds.add(loadedPostId);
    void supabase
      .rpc("increment_post_views", { p_post_id: loadedPostId })
      .then(({ error }) => {
        if (error) console.warn("increment_post_views failed", error.message);
      });
  }, [loadedPostId]);

  const replyMutation = useMutation({
    mutationFn: ({ content, replyToId }: { content: string; replyToId: string }) =>
      createPost(userId, content, { replyToId }),
    onSuccess: (_created, vars) => {
      setReplyText("");
      setReplyTarget(null);
      if (vars.replyToId !== id) {
        setExpandedCommentId(vars.replyToId);
        queryClient.invalidateQueries({ queryKey: ["comment-replies", vars.replyToId] });
      }
      // The comment list also carries the reply counts the expanders show.
      queryClient.invalidateQueries({ queryKey: ["post-replies", id] });
      // Refresh the parent post too so comment_count stays honest.
      queryClient.invalidateQueries({ queryKey: ["post", id] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  // Client-side gate only; the who_can_comment trigger is the real
  // enforcement. "following" means the AUTHOR follows the VIEWER.
  const post = postQuery.data;
  const gateOnFollow =
    !!post && post.who_can_comment === "following" && post.user_id !== userId;
  const { data: authorFollowsViewer } = useQuery({
    // Its own key: the ["follow-state", ...] entries hold the profile
    // screen's follow/requested/none string, not a boolean.
    queryKey: ["author-follows-viewer", post?.user_id, userId],
    queryFn: () => checkFollowing(post!.user_id, userId),
    enabled: gateOnFollow && !!userId,
  });

  const canComment =
    !post ||
    post.user_id === userId ||
    post.who_can_comment === "everyone" ||
    (post.who_can_comment === "following" && (authorFollowsViewer ?? false));

  const trimmedReply = replyText.trim();
  const canSend = trimmedReply.length > 0 && !replyMutation.isPending;

  if (postQuery.isLoading || (parentPostId && originalQuery.isLoading)) {
    return (
      <View style={styles.fill}>
        <Stack.Screen options={{ title: "Post" }} />
        <PostListSkeleton count={3} />
      </View>
    );
  }

  if (postQuery.error) {
    return (
      <Centered>
        <Stack.Screen options={{ title: "Post" }} />
        <EmptyState
          title="Could not load this post"
          description={
            postQuery.error instanceof Error ? postQuery.error.message : "Something went wrong."
          }
          action={<Button label="Retry" variant="outline" onPress={() => postQuery.refetch()} />}
        />
      </Centered>
    );
  }

  // Missing and not-visible-to-you (close friends) look the same: no row.
  if (!post) {
    return (
      <Centered>
        <Stack.Screen options={{ title: "Post" }} />
        <EmptyState
          title="This post isn't available."
          description="It may have been deleted, or it's only shared with close friends."
        />
      </Centered>
    );
  }

  const postDisplayId = displayPostId(post);

  // No explicit pick yet: fall back to the length-based default, which
  // settles once the replies query resolves.
  const replies = repliesQuery.data ?? [];
  const sort: CommentSort =
    sortChoice ?? (replies.length > TOP_SORT_MIN_COMMENTS ? "top" : "newest");
  const sortedReplies = [...replies].sort((a, b) => compareComments(a, b, sort));

  const mainCard = (
    <PostCard
      post={post}
      original={originalQuery.data ?? null}
      currentUserId={userId}
      isLiked={interactions?.likedPostIds.has(postDisplayId) ?? false}
      isBookmarked={interactions?.bookmarkedPostIds.has(postDisplayId) ?? false}
      isReposted={interactions?.repostedPostIds.has(postDisplayId) ?? false}
      userReaction={interactions?.reactions.get(postDisplayId) ?? null}
      reactionCounts={reactionCounts?.get(postDisplayId) ?? []}
      disableNavigation
      detail
      onReplyPress={() => {
        // The main card is already on its own detail route; the reply
        // icon focuses the composer instead of stacking a duplicate.
        setReplyTarget(null);
        replyInputRef.current?.focus();
      }}
    />
  );

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 96 : 0}
    >
      <Stack.Screen options={{ title: "Post" }} />
      <FlatList
        data={sortedReplies}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CommentThread
            comment={item}
            currentUserId={userId}
            isLiked={interactions?.likedPostIds.has(item.id) ?? false}
            isBookmarked={interactions?.bookmarkedPostIds.has(item.id) ?? false}
            isReposted={interactions?.repostedPostIds.has(item.id) ?? false}
            userReaction={interactions?.reactions.get(item.id) ?? null}
            reactionCounts={reactionCounts?.get(item.id) ?? []}
            expandSignal={expandedCommentId}
            onStartReply={(comment) => {
              setReplyTarget(comment);
              replyInputRef.current?.focus();
            }}
            canPin={post.user_id === userId}
            canComment={canComment}
          />
        )}
        initialNumToRender={8}
        windowSize={9}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={postQuery.isRefetching || repliesQuery.isRefetching}
            onRefresh={() => {
              postQuery.refetch();
              repliesQuery.refetch();
            }}
            tintColor={colors.mutedForeground}
          />
        }
        ListHeaderComponent={
          <View style={styles.postWrap}>
            {mainCard}
            {repliesQuery.isLoading ? <PostListSkeleton count={2} /> : null}
            {repliesQuery.error ? (
              <View style={styles.repliesError}>
                <Text style={styles.repliesErrorText}>Replies failed to load.</Text>
                <Button
                  label="Retry"
                  variant="outline"
                  onPress={() => repliesQuery.refetch()}
                />
              </View>
            ) : null}
            {sortedReplies.length > 1 ? (
              <CommentSortToggle sort={sort} onChange={setSortChoice} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          repliesQuery.isSuccess && repliesQuery.data.length === 0 ? (
            <Text style={styles.noReplies}>No replies yet. Start the conversation.</Text>
          ) : null
        }
      />
      {!canComment ? (
        <View style={styles.replyClosed}>
          <Text style={styles.replyClosedText}>
            {post.who_can_comment === "nobody"
              ? "Replies are turned off for this post"
              : "Only people the author follows can reply"}
          </Text>
        </View>
      ) : null}
      {canComment && replyTarget ? (
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
      {canComment ? (
        <View style={styles.replyBar}>
          <Avatar
            url={ownProfile?.avatar_url}
            name={ownProfile?.display_name || ownProfile?.username || "You"}
            size={32}
          />
          <MentionInput
            ref={replyInputRef}
            value={replyText}
            onChangeText={setReplyText}
            placeholder={`Reply to @${(replyTarget ?? post).profiles.username}`}
            placeholderTextColor={colors.textFaint}
            containerStyle={styles.replyInputWrap}
            style={styles.replyInput}
            panelPlacement="above"
            multiline
            maxLength={REPLY_MAX_LENGTH}
          />
          <MentionButton
            onPress={() => replyInputRef.current?.insertMentionTrigger()}
            disabled={replyMutation.isPending}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send reply"
            disabled={!canSend}
            onPress={() =>
              replyMutation.mutate({
                content: trimmedReply,
                replyToId: replyTarget?.id ?? id,
              })
            }
            style={({ pressed }) => [
              styles.sendButton,
              pressed && { opacity: 0.85 },
              !canSend && { opacity: 0.4 },
            ]}
          >
            {replyMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={styles.sendLabel}>Send</Text>
            )}
          </Pressable>
        </View>
      ) : null}
      {replyMutation.error ? (
        <Text style={styles.replyError}>
          {isCommentsClosedError(replyMutation.error)
            ? "Comments are limited on this post"
            : replyMutation.error instanceof Error
              ? replyMutation.error.message
              : "Reply failed to send."}
        </Text>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  postWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sortBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  sortEyebrow: {
    color: colors.mutedForeground,
    fontFamily: MONO_FONT,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  sortSegments: {
    flexDirection: "row",
    gap: 2,
    padding: 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sortSegment: {
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    borderRadius: 8,
  },
  sortSegmentActive: {
    backgroundColor: colors.surfaceElevated,
  },
  sortLabel: {
    color: colors.mutedForeground,
    fontFamily: MONO_FONT,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  sortLabelActive: {
    color: colors.primary,
  },
  repliesError: {
    padding: spacing(4),
    alignItems: "center",
    gap: spacing(3),
  },
  repliesErrorText: {
    color: colors.mutedForeground,
    fontSize: 13.5,
  },
  noReplies: {
    color: colors.mutedForeground,
    fontSize: 13.5,
    textAlign: "center",
    padding: spacing(6),
  },
  replyContext: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  replyContextText: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    flexShrink: 1,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing(2.5),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  replyInputWrap: {
    flex: 1,
  },
  replyInput: {
    minHeight: 36,
    maxHeight: 120,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    color: colors.foreground,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    fontSize: 14,
  },
  sendButton: {
    height: 36,
    minWidth: 56,
    paddingHorizontal: spacing(3),
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendLabel: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontWeight: "700",
  },
  replyClosed: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3.5),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  replyClosedText: {
    color: colors.mutedForeground,
    fontSize: 13,
    textAlign: "center",
  },
  replyError: {
    color: colors.destructive,
    fontSize: 12,
    textAlign: "center",
    paddingBottom: spacing(2),
    backgroundColor: colors.background,
  },
});
