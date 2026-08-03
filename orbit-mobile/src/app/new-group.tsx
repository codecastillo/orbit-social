import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Button } from "@/components/ui";
import { createGroupConversation } from "@/lib/queries/messages";
import { searchUsers, type ProfileSummary } from "@/lib/queries/search";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;
const NAME_MAX_LENGTH = 50;

export default function NewGroupScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [groupName, setGroupName] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<ProfileSummary[]>([]);

  useEffect(() => {
    const handle = setTimeout(
      () => setSearchTerm(searchInput.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(handle);
  }, [searchInput]);

  const searchQuery = useQuery({
    queryKey: ["new-group-search", searchTerm],
    queryFn: () => searchUsers(searchTerm, 10),
    enabled: !!user && searchTerm.length >= SEARCH_MIN_CHARS,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createGroupConversation(
        user!.id,
        groupName.trim(),
        selected.map((p) => p.id),
      ),
    onSuccess: (conversationId) => {
      router.replace(`/conversation/${conversationId}`);
    },
    onError: () => {
      Alert.alert("Couldn't create group", "Check your connection and try again.");
    },
  });

  if (!user) return null;

  const selectedIds = new Set(selected.map((p) => p.id));
  const results = (searchQuery.data ?? []).filter(
    (p) => p.id !== user.id && !selectedIds.has(p.id),
  );
  const canCreate =
    groupName.trim().length > 0 &&
    selected.length > 0 &&
    !createMutation.isPending;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "New group" }} />

      <Text style={styles.sectionTitle}>Group name</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder="Film photographers, sf trip"
          placeholderTextColor={colors.textFaint}
          value={groupName}
          onChangeText={setGroupName}
          maxLength={NAME_MAX_LENGTH}
          accessibilityLabel="Group name"
        />
      </View>

      <Text style={styles.sectionTitle}>
        Members{selected.length > 0 ? ` (${selected.length})` : ""}
      </Text>
      {selected.length > 0 ? (
        <View style={styles.chipWrap}>
          {selected.map((p) => (
            <Pressable
              key={p.id}
              onPress={() =>
                setSelected((prev) => prev.filter((s) => s.id !== p.id))
              }
              accessibilityRole="button"
              accessibilityLabel={`Remove ${p.display_name || p.username}`}
              style={styles.chip}
            >
              <Avatar
                url={p.avatar_url}
                name={p.display_name || p.username}
                size={22}
              />
              <Text style={styles.chipLabel} numberOfLines={1}>
                {p.display_name || p.username}
              </Text>
              <Ionicons name="close" size={13} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
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
        results.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => {
              setSelected((prev) => [...prev, p]);
              setSearchInput("");
            }}
            accessibilityRole="button"
            accessibilityLabel={`Add ${p.display_name || p.username}`}
            style={styles.resultRow}
          >
            <Avatar
              url={p.avatar_url}
              name={p.display_name || p.username}
              size={40}
            />
            <View style={styles.resultBody}>
              <Text style={styles.resultName} numberOfLines={1}>
                {p.display_name || p.username}
              </Text>
              <Text style={styles.resultUsername} numberOfLines={1}>
                @{p.username}
              </Text>
            </View>
            <Ionicons name="add" size={18} color={colors.textSecondary} />
          </Pressable>
        ))
      )}

      <View style={styles.footer}>
        <Button
          label={createMutation.isPending ? "Creating" : "Create group"}
          loading={createMutation.isPending}
          disabled={!canCreate}
          onPress={() => createMutation.mutate()}
        />
      </View>
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
    paddingBottom: spacing(10),
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
  inputWrap: {
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(2),
  },
  input: {
    minHeight: 42,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.foreground,
    paddingHorizontal: spacing(3.5),
    fontSize: 14.5,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(1.5),
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(2),
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing(1),
    paddingLeft: spacing(1),
    paddingRight: spacing(2.5),
    maxWidth: 220,
  },
  chipLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "500",
    flexShrink: 1,
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
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resultBody: {
    flex: 1,
    minWidth: 0,
  },
  resultName: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  resultUsername: {
    marginTop: 1,
    color: colors.mutedForeground,
    fontSize: 12.5,
  },
  footer: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(6),
  },
});
