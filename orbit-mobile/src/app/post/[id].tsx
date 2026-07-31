import { useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PostCard } from "@/components/post-card";
import { PostListSkeleton } from "@/components/post-skeleton";
import { Button, Centered, EmptyState } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import {
  checkUserInteractions,
  createPost,
  getPost,
  getReplies,
  type Post,
} from "@/lib/queries/posts";
import { colors, radii, spacing } from "@/lib/theme";

const REPLY_MAX_LENGTH = 500;

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";
  const [replyText, setReplyText] = useState("");

  const postQuery = useQuery({
    queryKey: ["post", id],
    queryFn: () => getPost(id),
    enabled: !!id,
  });

  const repliesQuery = useQuery({
    queryKey: ["post-replies", id],
    queryFn: () => getReplies(id),
    enabled: !!id,
  });

  const visibleIds = [
    ...(postQuery.data ? [postQuery.data.id] : []),
    ...(repliesQuery.data?.map((r) => r.id) ?? []),
  ];

  const { data: interactions } = useQuery({
    queryKey: ["post-interactions", userId, visibleIds],
    queryFn: () => checkUserInteractions(userId, visibleIds),
    enabled: !!userId && visibleIds.length > 0,
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

  if (postQuery.isLoading) {
    return (
      <View style={styles.fill}>
        <Stack.Screen options={{ title: "Post" }} />
        <PostListSkeleton count={3} />
      </View>
    );
  }

  if (postQuery.error || !postQuery.data) {
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

  const post = postQuery.data;

  const renderReply = ({ item }: { item: Post }) => (
    <PostCard
      post={item}
      currentUserId={userId}
      isLiked={interactions?.likedPostIds.has(item.id) ?? false}
      isBookmarked={interactions?.bookmarkedPostIds.has(item.id) ?? false}
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
        data={repliesQuery.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderReply}
        ListHeaderComponent={
          <View style={styles.postWrap}>
            <PostCard
              post={post}
              currentUserId={userId}
              isLiked={interactions?.likedPostIds.has(post.id) ?? false}
              isBookmarked={interactions?.bookmarkedPostIds.has(post.id) ?? false}
              disableNavigation
            />
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
        <TextInput
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
          style={[styles.sendButton, !canSend && { opacity: 0.4 }]}
        >
          {replyMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Ionicons name="arrow-up" size={18} color={colors.primaryForeground} />
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
    minHeight: 40,
    maxHeight: 120,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.foreground,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2.5),
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  replyError: {
    color: colors.destructive,
    fontSize: 12,
    textAlign: "center",
    paddingBottom: spacing(2),
    backgroundColor: colors.background,
  },
});
