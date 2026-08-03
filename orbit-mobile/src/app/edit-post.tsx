import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Centered, EmptyState } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { getPost, type Post } from "@/lib/queries/posts";
import { updatePost } from "@/lib/queries/post-management";
import { colors, radii, spacing } from "@/lib/theme";

const POST_MAX_LENGTH = 500;
const COUNTER_WARN_THRESHOLD = 20;

function EditPostForm({ post }: { post: Post }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [content, setContent] = useState(post.content ?? "");
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () => updatePost(post.id, content.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["post", post.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      router.back();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "The post could not be saved.");
    },
  });

  const trimmed = content.trim();
  const canSave = trimmed.length > 0 && trimmed !== (post.content ?? "").trim();
  const remaining = POST_MAX_LENGTH - content.length;

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save changes"
              disabled={!canSave || saveMutation.isPending}
              onPress={() => saveMutation.mutate()}
              style={({ pressed }) => [
                styles.savePill,
                pressed && { opacity: 0.85 },
                (!canSave || saveMutation.isPending) && { opacity: 0.5 },
              ]}
            >
              {saveMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={styles.savePillLabel}>Save</Text>
              )}
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="What is happening in your orbit?"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          multiline
          autoFocus
          maxLength={POST_MAX_LENGTH}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.toolbar}>
        <Text
          style={[
            styles.counter,
            remaining <= COUNTER_WARN_THRESHOLD && { color: colors.warning },
          ]}
        >
          {remaining}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const { data: post, isPending, isError, refetch } = useQuery({
    queryKey: ["post", id],
    queryFn: () => getPost(id!),
    enabled: !!id,
  });

  const screenOptions = (
    <Stack.Screen
      options={{
        title: "Edit post",
        presentation: "modal",
        headerTitleAlign: "center",
        headerTitleStyle: { fontSize: 16, fontWeight: "700" },
        headerLeft: () => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        ),
      }}
    />
  );

  if (isPending) {
    return (
      <View style={styles.fill}>
        {screenOptions}
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </View>
    );
  }

  // Editing is author-only; a missing or foreign post has nothing to edit.
  if (isError || !post || post.user_id !== user?.id) {
    return (
      <View style={styles.fill}>
        {screenOptions}
        <EmptyState
          title="Post not available"
          description="It may have been deleted, or it isn't yours to edit."
          action={
            isError ? (
              <Button label="Retry" variant="outline" onPress={() => refetch()} />
            ) : undefined
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {screenOptions}
      <EditPostForm post={post} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cancelLabel: {
    color: colors.foreground,
    fontSize: 15,
  },
  savePill: {
    minHeight: 32,
    paddingHorizontal: spacing(4),
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  savePillLabel: {
    color: colors.primaryForeground,
    fontSize: 13.5,
    fontWeight: "700",
  },
  body: {
    padding: spacing(4),
  },
  input: {
    color: colors.foreground,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 120,
    paddingTop: spacing(2),
    textAlignVertical: "top",
  },
  errorText: {
    color: colors.destructive,
    fontSize: 13,
    marginTop: spacing(3),
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  counter: {
    marginLeft: "auto",
    color: colors.mutedForeground,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
});
