import { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PostCard } from "@/components/post-card";
import { PostListSkeleton } from "@/components/post-skeleton";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { getOwnProfile } from "@/lib/queries/profiles";
import {
  checkUserInteractions,
  createPost,
  displayPostId,
  getPost,
  getPostsByIds,
  getReplies,
  type Post,
} from "@/lib/queries/posts";
import { getPostsReactionCounts } from "@/lib/queries/reactions";
import { colors, spacing } from "@/lib/theme";

const REPLY_MAX_LENGTH = 500;

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";
  const [replyText, setReplyText] = useState("");
  const replyInputRef = useRef<TextInput>(null);

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

  const repliesQuery = useQuery({
    queryKey: ["post-replies", id],
    queryFn: () => getReplies(id),
    enabled: !!id,
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

  const replyMutation = useMutation({
    mutationFn: (content: string) => createPost(userId, content, { replyToId: id }),
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["post-replies", id] });
      // Refresh the parent post too so comment_count stays honest.
      queryClient.invalidateQueries({ queryKey: ["post", id] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

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
  if (!postQuery.data) {
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

  const post = postQuery.data;
  const postDisplayId = displayPostId(post);

  const cardFor = (item: Post, options?: { main?: boolean }) => {
    const displayId = options?.main ? postDisplayId : item.id;
    return (
      <PostCard
        post={item}
        original={options?.main ? (originalQuery.data ?? null) : null}
        currentUserId={userId}
        isLiked={interactions?.likedPostIds.has(displayId) ?? false}
        isBookmarked={interactions?.bookmarkedPostIds.has(displayId) ?? false}
        isReposted={interactions?.repostedPostIds.has(displayId) ?? false}
        userReaction={interactions?.reactions.get(displayId) ?? null}
        reactionCounts={reactionCounts?.get(displayId) ?? []}
        disableNavigation={options?.main}
        reply={!options?.main}
        detail={options?.main}
        onReplyPress={
          // The main card is already on its own detail route; the reply
          // icon focuses the composer instead of stacking a duplicate.
          options?.main ? () => replyInputRef.current?.focus() : undefined
        }
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 96 : 0}
    >
      <Stack.Screen options={{ title: "Post" }} />
      <FlatList
        data={repliesQuery.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => cardFor(item)}
        initialNumToRender={8}
        windowSize={9}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={styles.postWrap}>
            {cardFor(post, { main: true })}
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
          </View>
        }
        ListEmptyComponent={
          repliesQuery.isSuccess && repliesQuery.data.length === 0 ? (
            <Text style={styles.noReplies}>No replies yet. Start the conversation.</Text>
          ) : null
        }
      />
      <View style={styles.replyBar}>
        <Avatar
          url={ownProfile?.avatar_url}
          name={ownProfile?.display_name || ownProfile?.username || "You"}
          size={32}
        />
        <TextInput
          ref={replyInputRef}
          value={replyText}
          onChangeText={setReplyText}
          placeholder={`Reply to @${post.profiles.username}`}
          placeholderTextColor={colors.textFaint}
          style={styles.replyInput}
          multiline
          maxLength={REPLY_MAX_LENGTH}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send reply"
          disabled={!canSend}
          onPress={() => replyMutation.mutate(trimmedReply)}
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
      {replyMutation.error ? (
        <Text style={styles.replyError}>
          {replyMutation.error instanceof Error
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
  replyInput: {
    flex: 1,
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
  replyError: {
    color: colors.destructive,
    fontSize: 12,
    textAlign: "center",
    paddingBottom: spacing(2),
    backgroundColor: colors.background,
  },
});
