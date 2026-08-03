import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, EmptyState } from "@/components/ui";
import {
  addEventCohost,
  getEventCohosts,
  removeEventCohost,
  type EventCohost,
} from "@/lib/queries/events";
import { searchUsers, type ProfileSummary } from "@/lib/queries/search";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;

// Host-only co-host management, same search-to-add flow as the community
// members screen. Co-hosts are display and credit only for v1: the events
// UPDATE policy is creator-only, so they get no edit rights. The
// event_cohosts RLS enforces that only the event creator can write rows, so
// a non-host landing here just gets failing mutations.
export default function EventCohostsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const cohostsKey = ["event-cohosts", eventId];
  const cohostsQuery = useQuery({
    queryKey: cohostsKey,
    queryFn: () => getEventCohosts(eventId),
    enabled: !!eventId,
  });
  const cohosts = useMemo(() => cohostsQuery.data ?? [], [cohostsQuery.data]);
  const cohostIds = useMemo(
    () => new Set(cohosts.map((c) => c.user_id)),
    [cohosts],
  );

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    const handle = setTimeout(
      () => setSearchTerm(searchInput.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(handle);
  }, [searchInput]);

  const searchQuery = useQuery({
    queryKey: ["event-cohost-search", eventId, searchTerm],
    queryFn: () => searchUsers(searchTerm),
    enabled: searchTerm.length >= SEARCH_MIN_CHARS,
  });
  const candidates = (searchQuery.data ?? []).filter(
    (p) => p.id !== user?.id && !cohostIds.has(p.id),
  );

  const add = useMutation({
    mutationFn: (profile: ProfileSummary) =>
      addEventCohost(eventId, profile.id),
    onSuccess: (_, profile) => {
      setSearchInput("");
      queryClient.invalidateQueries({ queryKey: cohostsKey });
      Alert.alert(`Added @${profile.username} as a co-host`);
    },
    onError: () => Alert.alert("Couldn't add this co-host"),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => removeEventCohost(eventId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cohostsKey }),
    onError: () => Alert.alert("Couldn't remove this co-host"),
  });

  const confirmRemove = (cohost: EventCohost) => {
    const username = cohost.profiles.username;
    Alert.alert(
      `Remove @${username}?`,
      "They'll no longer show as a co-host on this event.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => remove.mutate(cohost.user_id),
        },
      ],
    );
  };

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: "Co-hosts" }} />
      <FlatList
        data={cohosts}
        keyExtractor={(c) => c.user_id}
        ListHeaderComponent={
          <View style={styles.searchBlock}>
            <Text style={styles.searchTitle}>Add a co-host</Text>
            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search by name or @handle"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              style={styles.searchInput}
            />
            {searchQuery.isFetching ? (
              <ActivityIndicator
                color={colors.primary}
                style={{ marginTop: spacing(3) }}
              />
            ) : (
              candidates.map((p) => (
                <View key={p.id} style={styles.personRow}>
                  <Avatar
                    url={p.avatar_url}
                    name={p.display_name || p.username}
                    size={40}
                  />
                  <View style={styles.personBody}>
                    <Text style={styles.personName} numberOfLines={1}>
                      {p.display_name || p.username}
                    </Text>
                    <Text style={styles.personUsername} numberOfLines={1}>
                      @{p.username}
                    </Text>
                  </View>
                  <Button
                    label="Add"
                    variant="outline"
                    loading={add.isPending && add.variables?.id === p.id}
                    onPress={() => add.mutate(p)}
                    style={styles.rowButton}
                  />
                </View>
              ))
            )}
            {searchTerm.length >= SEARCH_MIN_CHARS &&
            !searchQuery.isFetching &&
            candidates.length === 0 ? (
              <Text style={styles.searchEmpty}>No users found</Text>
            ) : null}
            <Text style={styles.sectionLabel}>
              CO-HOSTS · {cohosts.length}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.personRow}>
            <Avatar
              url={item.profiles.avatar_url}
              name={item.profiles.display_name || item.profiles.username}
              size={40}
            />
            <View style={styles.personBody}>
              <Text style={styles.personName} numberOfLines={1}>
                {item.profiles.display_name || item.profiles.username}
              </Text>
              <Text style={styles.personUsername} numberOfLines={1}>
                @{item.profiles.username}
              </Text>
            </View>
            <Button
              label="Remove"
              variant="outline"
              loading={remove.isPending && remove.variables === item.user_id}
              onPress={() => confirmRemove(item)}
              style={styles.rowButton}
            />
          </View>
        )}
        ListEmptyComponent={
          cohostsQuery.isPending ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : cohostsQuery.isError ? (
            <EmptyState
              title="Could not load co-hosts"
              action={
                <Button
                  label="Retry"
                  variant="outline"
                  onPress={() => cohostsQuery.refetch()}
                />
              }
            />
          ) : (
            <EmptyState
              title="No co-hosts yet"
              description="People you add show next to you on the event page."
            />
          )
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: spacing(10),
  },
  searchBlock: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
  },
  searchTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: spacing(2),
  },
  searchInput: {
    minHeight: 42,
    color: colors.foreground,
    fontSize: 14,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3),
  },
  searchEmpty: {
    color: colors.mutedForeground,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: spacing(3),
  },
  sectionLabel: {
    color: colors.mutedForeground,
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.4,
    marginTop: spacing(4),
    marginBottom: spacing(1),
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  personBody: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  personUsername: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 1,
  },
  rowButton: {
    minHeight: 32,
    borderRadius: 10,
    paddingHorizontal: spacing(3),
  },
  loading: {
    padding: spacing(8),
    alignItems: "center",
  },
});
