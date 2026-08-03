import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, EmptyState } from "@/components/ui";
import {
  addCloseFriend,
  getCloseFriends,
  removeCloseFriend,
  type BlockedProfile,
} from "@/lib/queries/settings";
import { searchUsers, type ProfileSummary } from "@/lib/queries/search";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;

function FriendRow({
  profile,
  actionLabel,
  actionVariant,
  onAction,
}: {
  profile: BlockedProfile;
  actionLabel: string;
  actionVariant: "primary" | "outline";
  onAction: () => void;
}) {
  return (
    <View style={styles.friendRow}>
      <Avatar
        url={profile.avatar_url}
        name={profile.display_name || profile.username}
        size={40}
      />
      <View style={styles.friendBody}>
        <Text style={styles.friendName} numberOfLines={1}>
          {profile.display_name || profile.username}
        </Text>
        <Text style={styles.friendUsername} numberOfLines={1}>
          @{profile.username}
        </Text>
      </View>
      <Button
        label={actionLabel}
        variant={actionVariant}
        onPress={onAction}
        style={styles.friendAction}
      />
    </View>
  );
}

export default function CloseFriendsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const friendsKey = ["close-friends", user?.id];

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const handle = setTimeout(
      () => setSearchTerm(searchInput.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(handle);
  }, [searchInput]);

  const friendsQuery = useQuery({
    queryKey: friendsKey,
    queryFn: () => getCloseFriends(user!.id),
    enabled: !!user,
  });

  const searchQuery = useQuery({
    queryKey: ["close-friend-search", searchTerm],
    queryFn: () => searchUsers(searchTerm, 10),
    enabled: !!user && searchTerm.length >= SEARCH_MIN_CHARS,
  });

  const addMutation = useMutation({
    mutationFn: (profile: BlockedProfile) => addCloseFriend(user!.id, profile.id),
    onMutate: async (profile) => {
      await queryClient.cancelQueries({ queryKey: friendsKey });
      const previous = queryClient.getQueryData<BlockedProfile[]>(friendsKey);
      // New friends land at the top, matching the created_at desc ordering.
      queryClient.setQueryData<BlockedProfile[]>(friendsKey, (list) => [
        profile,
        ...(list ?? []),
      ]);
      return { previous };
    },
    onError: (_error, profile, context) => {
      queryClient.setQueryData(friendsKey, context?.previous);
      Alert.alert(`Couldn't add @${profile.username}`);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (profile: BlockedProfile) =>
      removeCloseFriend(user!.id, profile.id),
    onMutate: async (profile) => {
      await queryClient.cancelQueries({ queryKey: friendsKey });
      const previous = queryClient.getQueryData<BlockedProfile[]>(friendsKey);
      queryClient.setQueryData<BlockedProfile[]>(friendsKey, (list) =>
        list?.filter((p) => p.id !== profile.id),
      );
      return { previous };
    },
    onError: (_error, profile, context) => {
      queryClient.setQueryData(friendsKey, context?.previous);
      Alert.alert(`Couldn't remove @${profile.username}`);
    },
  });

  if (!user) return null;

  const friends = friendsQuery.data ?? [];
  const friendIds = new Set(friends.map((f) => f.id));
  const results = (searchQuery.data ?? []).filter(
    (p: ProfileSummary) => p.id !== user.id && !friendIds.has(p.id),
  );

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Close friends" }} />

      <Text style={styles.explainer}>
        A smaller radius. Posts and moments marked close friends only reach
        this list.
      </Text>

      <Text style={styles.sectionTitle}>Add people</Text>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or username"
          placeholderTextColor={colors.textFaint}
          value={searchInput}
          onChangeText={setSearchInput}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search people to add"
        />
      </View>
      {searchQuery.isFetching ? (
        <View style={styles.sectionPending}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : searchQuery.isError ? (
        <Text style={styles.sectionEmpty}>
          Search failed. Check your connection and try again.
        </Text>
      ) : searchTerm.length >= SEARCH_MIN_CHARS && results.length === 0 ? (
        <Text style={styles.sectionEmpty}>No one found for that search.</Text>
      ) : (
        results.map((profile) => (
          <FriendRow
            key={profile.id}
            profile={profile}
            actionLabel="Add"
            actionVariant="primary"
            onAction={() => addMutation.mutate(profile)}
          />
        ))
      )}

      <Text style={styles.sectionTitle}>
        Your close friends{friendsQuery.data ? ` (${friends.length})` : ""}
      </Text>
      {friendsQuery.isPending ? (
        <View style={styles.sectionPending}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : friendsQuery.isError ? (
        <EmptyState
          title="Close friends did not load"
          description="Check your connection and try again."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => friendsQuery.refetch()}
            />
          }
        />
      ) : friends.length === 0 ? (
        <Text style={styles.sectionEmpty}>
          No close friends yet. Search above to add someone.
        </Text>
      ) : (
        friends.map((profile) => (
          <FriendRow
            key={profile.id}
            profile={profile}
            actionLabel="Remove"
            actionVariant="outline"
            onAction={() => removeMutation.mutate(profile)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingVertical: spacing(2),
  },
  explainer: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  sectionTitle: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    paddingBottom: spacing(1),
  },
  searchWrap: {
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(2),
  },
  searchInput: {
    minHeight: 42,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.foreground,
    paddingHorizontal: spacing(3.5),
    fontSize: 14.5,
  },
  sectionPending: {
    paddingVertical: spacing(4),
  },
  sectionEmpty: {
    color: colors.mutedForeground,
    fontSize: 13,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  friendBody: {
    flex: 1,
    minWidth: 0,
  },
  friendName: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  friendUsername: {
    marginTop: 1,
    color: colors.mutedForeground,
    fontSize: 12.5,
  },
  friendAction: {
    minHeight: 34,
    paddingHorizontal: spacing(3.5),
  },
});
