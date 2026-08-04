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
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, Button, EmptyState } from "@/components/ui";
import {
  checkFollowStates,
  getFollowers,
  getFollowing,
  toggleFollowState,
  type FollowState,
  type ProfileSummary,
} from "@/lib/queries/profiles";
import {
  BLOCKED_FOLLOW_MESSAGE,
  isBlockedFollowError,
} from "@/lib/blocked-error";
import { colors, radii, spacing } from "@/lib/theme";

type FollowTab = "followers" | "following";

const TITLE_STYLE = { fontSize: 17, fontWeight: "700" } as const;

function FollowRow({
  profile,
  isSelf,
  followState,
  busy,
  onToggle,
  onOpen,
}: {
  profile: ProfileSummary;
  isSelf: boolean;
  followState: FollowState;
  busy: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      <Avatar
        url={profile.avatar_url}
        name={profile.display_name || profile.username}
        size={44}
      />
      <View style={styles.rowText}>
        <View style={styles.nameRow}>
          <Text style={styles.displayName} numberOfLines={1}>
            {profile.display_name || profile.username}
          </Text>
          {profile.is_verified ? (
            <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
          ) : null}
        </View>
        <Text style={styles.username} numberOfLines={1}>
          @{profile.username}
        </Text>
      </View>
      {!isSelf ? (
        <Button
          label={
            followState === "following"
              ? "Following"
              : followState === "requested"
                ? "Requested"
                : "Follow"
          }
          variant={followState === "none" ? "primary" : "outline"}
          disabled={busy}
          onPress={onToggle}
          style={styles.followButton}
        />
      ) : null}
    </Pressable>
  );
}

/**
 * Followers/following lists behind the profile stats, one segmented screen
 * for both, mirroring the web FollowListDialog: rows link to the profile
 * and carry a follow toggle with optimistic state.
 */
export default function FollowListScreen() {
  const params = useLocalSearchParams<{
    userId: string;
    username: string;
    tab: string;
  }>();
  const userId = typeof params.userId === "string" ? params.userId : "";
  const username = typeof params.username === "string" ? params.username : "";
  const router = useRouter();
  const { user } = useAuth();

  const [tab, setTab] = useState<FollowTab>(
    params.tab === "following" ? "following" : "followers",
  );
  // Overlays the fetched follow state so toggles feel instant.
  const [overrides, setOverrides] = useState<Record<string, FollowState>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["follow-list", userId, tab],
    queryFn: () =>
      tab === "followers" ? getFollowers(userId) : getFollowing(userId),
    enabled: !!userId,
  });

  const rows = listQuery.data ?? [];

  const followStatesQuery = useQuery({
    queryKey: ["follow-list-status", user?.id, userId, tab, rows.length],
    queryFn: () =>
      checkFollowStates(
        user!.id,
        rows.map((p) => p.id),
      ),
    enabled: !!user && rows.length > 0,
  });

  const followStateOf = (id: string): FollowState =>
    overrides[id] ?? followStatesQuery.data?.get(id) ?? "none";

  const toggleFollow = async (target: ProfileSummary) => {
    if (!user || busyId) return;
    const current = followStateOf(target.id);
    setBusyId(target.id);
    try {
      const next = await toggleFollowState(user.id, target.id, current);
      setOverrides((m) => ({ ...m, [target.id]: next }));
    } catch (error) {
      if (current === "none" && isBlockedFollowError(error)) {
        Alert.alert(BLOCKED_FOLLOW_MESSAGE);
      } else {
        Alert.alert("Couldn't update follow");
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: username ? `@${username}` : "Connections",
          headerTitleStyle: TITLE_STYLE,
        }}
      />

      <View style={styles.segments}>
        {(["followers", "following"] as const).map((key) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(key)}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Text
                style={[styles.segmentLabel, active && styles.segmentLabelActive]}
              >
                {key === "followers" ? "Followers" : "Following"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {listQuery.isPending ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : listQuery.isError ? (
        <EmptyState
          title="Could not load this list"
          description="Check your connection and try again."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => listQuery.refetch()}
            />
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            tab === "followers" ? "No followers yet" : "Not following anyone yet"
          }
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <FollowRow
              profile={item}
              isSelf={item.id === user?.id}
              followState={followStateOf(item.id)}
              busy={busyId === item.id}
              onToggle={() => toggleFollow(item)}
              onOpen={() => router.push(`/user/${item.username}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
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
  segments: {
    flexDirection: "row",
    margin: spacing(3),
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: 3,
  },
  segment: {
    flex: 1,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm - 2,
  },
  segmentActive: {
    backgroundColor: colors.surfaceElevated,
  },
  segmentLabel: {
    color: colors.mutedForeground,
    fontSize: 13.5,
    fontWeight: "600",
  },
  segmentLabelActive: {
    color: colors.foreground,
  },
  state: {
    padding: spacing(8),
    alignItems: "center",
  },
  listContent: {
    paddingBottom: spacing(8),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  displayName: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  username: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 1,
  },
  followButton: {
    minHeight: 34,
    paddingHorizontal: spacing(4),
  },
});
