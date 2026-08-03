import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, EmptyState } from "@/components/ui";
import {
  getCommunityMembers,
  inviteCommunityUser,
  removeCommunityMember,
  setCommunityMemberRole,
  type CommunityMember,
  type CommunityRole,
} from "@/lib/queries/communities";
import { searchUsers, type ProfileSummary } from "@/lib/queries/search";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;

const ROLE_LABEL: Record<CommunityRole, string> = {
  owner: "OWNER",
  moderator: "MOD",
  member: "",
};

const ROLE_ORDER: Record<CommunityRole, number> = {
  owner: 0,
  moderator: 1,
  member: 2,
};

function MemberRow({
  member,
  showMenu,
  onMenu,
}: {
  member: CommunityMember;
  showMenu: boolean;
  onMenu: () => void;
}) {
  const label = ROLE_LABEL[member.role];
  return (
    <View style={styles.memberRow}>
      <Avatar
        url={member.profiles.avatar_url}
        name={member.profiles.display_name || member.profiles.username}
        size={40}
      />
      <View style={styles.memberBody}>
        <Text style={styles.memberName} numberOfLines={1}>
          {member.profiles.display_name || member.profiles.username}
        </Text>
        <Text style={styles.memberUsername} numberOfLines={1}>
          @{member.profiles.username}
        </Text>
      </View>
      {label ? (
        <Text
          style={[
            styles.roleBadge,
            member.role === "owner" ? styles.roleBadgeOwner : styles.roleBadgeMod,
          ]}
        >
          {label}
        </Text>
      ) : null}
      {showMenu ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Manage @${member.profiles.username}`}
          onPress={onMenu}
          style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.menuButtonLabel}>···</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function CommunityMembersScreen() {
  const { communityId, role } = useLocalSearchParams<{
    communityId: string;
    role: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isOwner = role === "owner";
  const canInvite = role === "owner" || role === "moderator";

  const membersKey = ["community-members", communityId];
  const membersQuery = useQuery({
    queryKey: membersKey,
    queryFn: () => getCommunityMembers(communityId),
    enabled: !!communityId,
  });

  const members = useMemo(
    () =>
      [...(membersQuery.data ?? [])].sort(
        (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role],
      ),
    [membersQuery.data],
  );
  const memberIds = useMemo(
    () => new Set(members.map((m) => m.user_id)),
    [members],
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
    queryKey: ["community-invite-search", communityId, searchTerm],
    queryFn: () => searchUsers(searchTerm),
    enabled: canInvite && searchTerm.length >= SEARCH_MIN_CHARS,
  });
  const candidates = (searchQuery.data ?? []).filter(
    (p) => p.id !== user?.id && !memberIds.has(p.id),
  );

  const invite = useMutation({
    mutationFn: (profile: ProfileSummary) =>
      inviteCommunityUser(communityId, profile.id),
    onSuccess: (_, profile) => {
      setSearchInput("");
      queryClient.invalidateQueries({ queryKey: membersKey });
      Alert.alert(`Added @${profile.username} to the room`);
    },
    onError: () => Alert.alert("Couldn't invite this user"),
  });

  const setRole = useMutation({
    mutationFn: ({
      userId,
      newRole,
    }: {
      userId: string;
      newRole: "moderator" | "member";
    }) => setCommunityMemberRole(communityId, userId, newRole),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey }),
    onError: () => Alert.alert("Couldn't update this member's role"),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => removeCommunityMember(communityId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey }),
    onError: () => Alert.alert("Couldn't remove this member"),
  });

  const openMemberMenu = (member: CommunityMember) => {
    const username = member.profiles.username;
    Alert.alert(`@${username}`, undefined, [
      { text: "View profile", onPress: () => router.push(`/user/${username}`) },
      member.role === "moderator"
        ? {
            text: "Demote to member",
            onPress: () =>
              setRole.mutate({ userId: member.user_id, newRole: "member" }),
          }
        : {
            text: "Promote to moderator",
            onPress: () =>
              setRole.mutate({ userId: member.user_id, newRole: "moderator" }),
          },
      {
        text: "Remove from room",
        style: "destructive",
        onPress: () =>
          Alert.alert(`Remove @${username}?`, "They'll be removed from this room.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Remove",
              style: "destructive",
              onPress: () => remove.mutate(member.user_id),
            },
          ]),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: "Members" }} />
      <FlatList
        data={members}
        keyExtractor={(m) => m.user_id}
        ListHeaderComponent={
          canInvite ? (
            <View style={styles.inviteBlock}>
              <Text style={styles.inviteTitle}>Invite people</Text>
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
                  <View key={p.id} style={styles.memberRow}>
                    <Avatar
                      url={p.avatar_url}
                      name={p.display_name || p.username}
                      size={40}
                    />
                    <View style={styles.memberBody}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {p.display_name || p.username}
                      </Text>
                      <Text style={styles.memberUsername} numberOfLines={1}>
                        @{p.username}
                      </Text>
                    </View>
                    <Button
                      label="Invite"
                      variant="outline"
                      loading={invite.isPending && invite.variables?.id === p.id}
                      onPress={() => invite.mutate(p)}
                      style={styles.inviteButton}
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
                MEMBERS · {members.length}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <MemberRow
            member={item}
            // Owner-only management, and never on the owner's own row or on
            // another owner, mirroring the web members dialog.
            showMenu={
              isOwner && item.user_id !== user?.id && item.role !== "owner"
            }
            onMenu={() => openMemberMenu(item)}
          />
        )}
        ListEmptyComponent={
          membersQuery.isPending ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : membersQuery.isError ? (
            <EmptyState
              title="Could not load members"
              action={
                <Button
                  label="Retry"
                  variant="outline"
                  onPress={() => membersQuery.refetch()}
                />
              }
            />
          ) : (
            <EmptyState title="Nobody's here yet" />
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
  inviteBlock: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
  },
  inviteTitle: {
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
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  memberBody: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  memberUsername: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 1,
  },
  roleBadge: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing(2),
    paddingVertical: 3,
    overflow: "hidden",
  },
  roleBadgeOwner: {
    color: colors.warning,
    borderColor: "rgba(255, 178, 36, 0.4)",
  },
  roleBadgeMod: {
    color: colors.primary,
    borderColor: "rgba(172, 119, 250, 0.4)",
  },
  menuButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  menuButtonLabel: {
    color: colors.mutedForeground,
    fontSize: 16,
    fontWeight: "700",
  },
  inviteButton: {
    minHeight: 32,
    borderRadius: 10,
    paddingHorizontal: spacing(3),
  },
  loading: {
    padding: spacing(8),
    alignItems: "center",
  },
});
