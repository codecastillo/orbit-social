import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, EmptyState } from "@/components/ui";
import {
  getCommunityBans,
  getCommunityModerationLog,
  unbanCommunityMember,
  type ModerationLogEntry,
} from "@/lib/queries/communities";
import { formatTimeAgo } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

type Tab = "banned" | "log";

/** Past tense, because the log records what already happened. */
const ACTION_LABELS: Record<string, string> = {
  ban: "banned",
  unban: "lifted the ban on",
  remove_member: "removed",
  role_change: "changed the role of",
  post_removed: "removed a post by",
  post_pinned: "pinned a post by",
  post_unpinned: "unpinned a post by",
};

/**
 * Who is banned from this room, and what the moderators have done. Visible to
 * owners and moderators; the RLS policies on both tables enforce that, so a
 * member reaching this route sees empty lists rather than an error.
 */
export default function RoomModerationScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("banned");

  const bansQuery = useQuery({
    queryKey: ["community-bans", communityId],
    queryFn: () => getCommunityBans(communityId),
    enabled: !!communityId,
  });

  const logQuery = useQuery({
    queryKey: ["community-moderation-log", communityId],
    queryFn: () => getCommunityModerationLog(communityId),
    enabled: !!communityId && tab === "log",
  });

  const unban = useMutation({
    mutationFn: (userId: string) => unbanCommunityMember(communityId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-bans", communityId] });
      queryClient.invalidateQueries({
        queryKey: ["community-moderation-log", communityId],
      });
    },
    onError: () => Alert.alert("Couldn't lift this ban"),
  });

  const describe = (entry: ModerationLogEntry) => {
    const actor = entry.actor?.username ? `@${entry.actor.username}` : "A moderator";
    const action = ACTION_LABELS[entry.action] ?? entry.action;
    const target = entry.target?.username ? `@${entry.target.username}` : "someone";
    return `${actor} ${action} ${target}`;
  };

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: "Moderation" }} />

      <View style={styles.tabs}>
        {(["banned", "log"] as Tab[]).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, tab === value && styles.tabLabelActive]}>
              {value === "banned" ? "Banned" : "Activity"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "banned" ? (
        <FlatList
          data={bansQuery.data ?? []}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            bansQuery.isPending ? (
              <ActivityIndicator style={styles.loading} color={colors.primary} />
            ) : (
              <EmptyState
                icon="shield-checkmark-outline"
                title="Nobody is banned"
                description="Ban someone from the members list and they show up here, with a way to lift it."
              />
            )
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar
                url={item.profiles.avatar_url}
                name={item.profiles.display_name}
                size={40}
              />
              <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.profiles.display_name}
                </Text>
                <Text style={styles.handle} numberOfLines={1}>
                  @{item.profiles.username}
                </Text>
                <Text style={styles.detail}>
                  {item.reason ? item.reason : "No reason given"}
                  {"  ·  "}
                  {item.expires_at
                    ? `until ${new Date(item.expires_at).toLocaleDateString()}`
                    : "indefinite"}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Lift the ban on ${item.profiles.username}`}
                onPress={() => unban.mutate(item.user_id)}
                hitSlop={8}
                style={({ pressed }) => [styles.unban, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.unbanLabel}>Unban</Text>
              </Pressable>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={logQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            logQuery.isPending ? (
              <ActivityIndicator style={styles.loading} color={colors.primary} />
            ) : (
              <EmptyState
                icon="document-text-outline"
                title="No moderator activity yet"
                description="Bans, removals, and role changes are recorded here so the room's staff can see what happened."
              />
            )
          }
          renderItem={({ item }) => (
            <View style={styles.logRow}>
              <Text style={styles.logText}>{describe(item)}</Text>
              {item.reason ? (
                <Text style={styles.logReason}>{item.reason}</Text>
              ) : null}
              <Text style={styles.logTime}>{formatTimeAgo(item.created_at)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabs: {
    flexDirection: "row",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    borderRadius: radii.full,
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: colors.primaryForeground,
  },
  listContent: {
    padding: spacing(4),
    gap: spacing(3),
  },
  loading: {
    paddingVertical: spacing(8),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  handle: {
    color: colors.mutedForeground,
    fontSize: 12.5,
  },
  detail: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
  unban: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  unbanLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
  },
  logRow: {
    gap: 2,
    paddingBottom: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  logText: {
    color: colors.foreground,
    fontSize: 14,
  },
  logReason: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    lineHeight: 17,
  },
  logTime: {
    color: colors.textFaint,
    fontSize: 11.5,
    marginTop: 2,
  },
});
