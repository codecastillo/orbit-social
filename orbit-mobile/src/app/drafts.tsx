import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Centered, EmptyState } from "@/components/ui";
import { stageDraftRestore } from "@/lib/draft-restore";
import {
  deleteDraft,
  listDrafts,
  type PostDraft,
} from "@/lib/queries/drafts";
import { formatTimeAgo } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { colors, spacing } from "@/lib/theme";

function DraftRow({
  draft,
  onPress,
  onDelete,
}: {
  draft: PostDraft;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Keep writing this draft"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.rowBody}>
        <Text style={styles.rowTime}>
          {formatTimeAgo(draft.updated_at || draft.created_at)}
        </Text>
        <Text style={styles.rowExcerpt} numberOfLines={3}>
          {draft.content.trim() || "No text yet"}
        </Text>
        {draft.draft_data.location ? (
          <View style={styles.rowLocation}>
            <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
            <Text style={styles.rowLocationText} numberOfLines={1}>
              {draft.draft_data.location}
            </Text>
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete draft"
        onPress={onDelete}
        hitSlop={8}
        style={({ pressed }) => [styles.delete, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="trash-outline" size={20} color={colors.destructive} />
      </Pressable>
    </Pressable>
  );
}

export default function DraftsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const draftsKey = ["post-drafts", user?.id];

  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: draftsKey,
    queryFn: () => listDrafts(user!.id),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: (draftId: string) => deleteDraft(draftId),
    onMutate: async (draftId) => {
      await queryClient.cancelQueries({ queryKey: draftsKey });
      const previous = queryClient.getQueryData<PostDraft[]>(draftsKey);
      queryClient.setQueryData<PostDraft[]>(draftsKey, (drafts) =>
        drafts?.filter((d) => d.id !== draftId),
      );
      return { previous };
    },
    onError: (_error, _draftId, context) => {
      queryClient.setQueryData(draftsKey, context?.previous);
      Alert.alert("Couldn't delete", "Check your connection and try again.");
    },
  });

  const openDraft = (draft: PostDraft) => {
    // The composer consumes this snapshot on mount, the same handoff its
    // undo restore uses.
    stageDraftRestore(draft);
    router.push("/compose" as Href);
  };

  const confirmDelete = (draft: PostDraft) => {
    Alert.alert("Delete draft?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate(draft.id),
      },
    ]);
  };

  if (!user) return null;

  if (isPending) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Drafts" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Drafts" }} />
        <EmptyState
          title="Drafts did not load"
          description="Check your connection and try again."
          action={
            <Button label="Retry" variant="outline" onPress={() => refetch()} />
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: "Drafts" }} />
      <FlatList
        data={data}
        keyExtractor={(draft) => draft.id}
        renderItem={({ item }) => (
          <DraftRow
            draft={item}
            onPress={() => openDraft(item)}
            onDelete={() => confirmDelete(item)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.mutedForeground}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="No drafts yet"
            description="Save a post as a draft and pick it back up here."
          />
        }
        contentContainerStyle={data?.length === 0 ? styles.flex : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTime: {
    color: colors.textFaint,
    fontSize: 12,
  },
  rowExcerpt: {
    marginTop: 2,
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 20,
  },
  rowLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing(1),
  },
  rowLocationText: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    flexShrink: 1,
  },
  delete: {
    padding: spacing(2),
  },
});
