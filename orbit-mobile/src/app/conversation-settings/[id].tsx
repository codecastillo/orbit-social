import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ReportSheet } from "@/components/report-sheet";
import { Avatar, Button, EmptyState } from "@/components/ui";
import { MediaGallerySheet } from "@/components/media-gallery-sheet";
import { stageConversationSearch } from "@/lib/conversation-search";
import {
  addGroupMember,
  closeConversation,
  getConversationInfo,
  getConversationMembership,
  getGroupMembers,
  leaveConversation,
  removeGroupMember,
  setConversationMuted,
  setGroupMemberRole,
  updateGroupName,
  type GroupMember,
} from "@/lib/queries/messages";
import { searchUsers, type ProfileSummary } from "@/lib/queries/search";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;
const NAME_MAX_LENGTH = 50;

export default function ConversationSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = id ?? "";
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [nameSeeded, setNameSeeded] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    const handle = setTimeout(
      () => setSearchTerm(searchInput.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(handle);
  }, [searchInput]);

  const infoKey = ["conversation-info", conversationId];
  const membersKey = ["conversation-members", conversationId];
  const membershipKey = ["conversation-membership", conversationId, user?.id];

  const infoQuery = useQuery({
    queryKey: infoKey,
    queryFn: () => getConversationInfo(conversationId),
    enabled: !!user && !!conversationId,
  });

  const membersQuery = useQuery({
    queryKey: membersKey,
    queryFn: () => getGroupMembers(conversationId),
    enabled: !!user && !!conversationId,
  });

  const membershipQuery = useQuery({
    queryKey: membershipKey,
    queryFn: () => getConversationMembership(conversationId, user!.id),
    enabled: !!user && !!conversationId,
  });

  const searchQuery = useQuery({
    queryKey: ["conversation-add-search", conversationId, searchTerm],
    queryFn: () => searchUsers(searchTerm, 10),
    enabled: !!user && searchTerm.length >= SEARCH_MIN_CHARS,
  });

  const info = infoQuery.data;
  const members = membersQuery.data ?? [];
  const membership = membershipQuery.data;

  // Seed the rename field once the conversation loads; later refetches must
  // not clobber an in-progress edit.
  if (info && !nameSeeded) {
    setName(info.name ?? "");
    setNameSeeded(true);
  }

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: infoKey });
    queryClient.invalidateQueries({ queryKey: membersKey });
    queryClient.invalidateQueries({ queryKey: membershipKey });
    // The conversations list shows group names and mute state.
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const renameMutation = useMutation({
    mutationFn: () => updateGroupName(conversationId, name.trim()),
    onSuccess: refetchAll,
    onError: () => Alert.alert("Couldn't rename group"),
  });

  const muteMutation = useMutation({
    mutationFn: (muted: boolean) =>
      setConversationMuted(conversationId, user!.id, muted),
    onMutate: async (muted) => {
      await queryClient.cancelQueries({ queryKey: membershipKey });
      const previous = queryClient.getQueryData(membershipKey);
      queryClient.setQueryData(
        membershipKey,
        (old: typeof membership) => old && { ...old, is_muted: muted },
      );
      return { previous };
    },
    onError: (_error, _muted, context) => {
      queryClient.setQueryData(membershipKey, context?.previous);
      Alert.alert("Couldn't update mute");
    },
  });

  const addMutation = useMutation({
    mutationFn: (profile: ProfileSummary) =>
      addGroupMember(conversationId, profile.id),
    onSuccess: () => {
      setSearchInput("");
      refetchAll();
    },
    onError: (_error, profile) =>
      Alert.alert(`Couldn't add @${profile.username}`),
  });

  const removeMutation = useMutation({
    mutationFn: (member: GroupMember) =>
      removeGroupMember(conversationId, member.user_id),
    onSuccess: refetchAll,
    onError: () => Alert.alert("Couldn't remove member"),
  });

  const roleMutation = useMutation({
    mutationFn: ({ member, role }: { member: GroupMember; role: "member" | "admin" }) =>
      setGroupMemberRole(conversationId, member.user_id, role),
    onSuccess: refetchAll,
    onError: () => Alert.alert("Couldn't change role"),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeConversation(conversationId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.replace("/(tabs)/messages" as Href);
    },
    onError: () => Alert.alert("Couldn't close conversation"),
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveConversation(conversationId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.replace("/(tabs)/messages" as Href);
    },
    onError: () => Alert.alert("Couldn't leave group"),
  });

  if (!user) return null;

  if (infoQuery.isPending || membershipQuery.isPending) {
    return (
      <View style={[styles.flex, styles.center]}>
        <Stack.Screen options={{ title: "Conversation" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (infoQuery.isError || !info) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Conversation" }} />
        <EmptyState
          title="Conversation did not load"
          description="Check your connection and try again."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => infoQuery.refetch()}
            />
          }
        />
      </View>
    );
  }

  const isGroup = info.is_group;
  const isCreator = info.created_by === user.id;
  const isAdmin = isCreator || membership?.role === "admin";
  const muted = membership?.is_muted ?? false;
  const otherMember = isGroup
    ? null
    : (members.find((m) => m.user_id !== user.id) ?? null);

  const memberIds = new Set(members.map((m) => m.user_id));
  const results = (searchQuery.data ?? []).filter(
    (p) => p.id !== user.id && !memberIds.has(p.id),
  );

  const confirmLeave = () => {
    Alert.alert(
      "Leave group?",
      "You'll stop receiving messages from this group. An admin can add you back.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => leaveMutation.mutate(),
        },
      ],
    );
  };

  const confirmRemove = (member: GroupMember) => {
    const label =
      member.profiles?.display_name || member.profiles?.username || "this member";
    Alert.alert(`Remove ${label}?`, "They'll no longer see new messages.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => removeMutation.mutate(member),
      },
    ]);
  };

  const confirmClose = () => {
    Alert.alert(
      "Close conversation?",
      "It disappears from your messages until someone sends a new message.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Close", onPress: () => closeMutation.mutate() },
      ],
    );
  };

  const trimmedName = name.trim();
  const canRename =
    trimmedName.length > 0 &&
    trimmedName !== (info.name ?? "") &&
    !renameMutation.isPending;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{ title: isGroup ? "Group settings" : "Conversation" }}
      />

      {!isGroup && otherMember?.profiles ? (
        <View style={styles.dmHeader}>
          <Avatar
            url={otherMember.profiles.avatar_url}
            name={
              otherMember.profiles.display_name || otherMember.profiles.username
            }
            size={64}
          />
          <Text style={styles.dmName}>
            {otherMember.profiles.display_name || otherMember.profiles.username}
          </Text>
          <Text style={styles.dmUsername}>@{otherMember.profiles.username}</Text>
          <Button
            label="View profile"
            variant="outline"
            style={styles.dmProfileButton}
            onPress={() =>
              router.push(`/user/${otherMember.profiles!.username}` as Href)
            }
          />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search in conversation"
        onPress={() => {
          // The search bar lives on the conversation screen; stage the
          // request and pop back so its focus effect opens the bar.
          stageConversationSearch(conversationId);
          router.back();
        }}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>Search in conversation</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.mutedForeground}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Shared media"
        onPress={() => setGalleryOpen(true)}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>Shared media</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.mutedForeground}
        />
      </Pressable>

      {isGroup ? (
        <>
          <Text style={styles.sectionTitle}>Group name</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, !isAdmin && styles.inputDisabled]}
              value={name}
              onChangeText={setName}
              editable={isAdmin}
              maxLength={NAME_MAX_LENGTH}
              placeholder="Group name"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Group name"
            />
            {isAdmin ? (
              <Button
                label={renameMutation.isPending ? "Saving" : "Save name"}
                loading={renameMutation.isPending}
                disabled={!canRename}
                onPress={() => renameMutation.mutate()}
                style={styles.saveButton}
              />
            ) : null}
          </View>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.row}>
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>Mute conversation</Text>
          <Text style={styles.rowDescription}>
            No message notifications from this conversation. You&apos;ll still
            see new messages in the thread.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Mute conversation"
          value={muted}
          onValueChange={(value) => muteMutation.mutate(value)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.foreground}
        />
      </View>

      {isGroup ? (
        <>
          <Text style={styles.sectionTitle}>
            Members{members.length > 0 ? ` (${members.length})` : ""}
          </Text>
          {membersQuery.isPending ? (
            <View style={styles.sectionPending}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            members.map((member) => {
              const profile = member.profiles;
              const isSelf = member.user_id === user.id;
              const memberIsAdmin = member.role === "admin";
              const busy =
                (roleMutation.isPending &&
                  roleMutation.variables?.member.user_id === member.user_id) ||
                (removeMutation.isPending &&
                  removeMutation.variables?.user_id === member.user_id);
              return (
                <View key={member.user_id} style={styles.memberRow}>
                  <Avatar
                    url={profile?.avatar_url ?? null}
                    name={profile?.display_name || profile?.username || "?"}
                    size={40}
                  />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel} numberOfLines={1}>
                      {profile?.display_name || profile?.username || "Member"}
                      {isSelf ? " (you)" : ""}
                    </Text>
                    <Text style={styles.memberMeta} numberOfLines={1}>
                      {profile ? `@${profile.username}` : ""}
                      {memberIsAdmin
                        ? `${profile ? " · " : ""}${
                            member.user_id === info.created_by
                              ? "Creator"
                              : "Admin"
                          }`
                        : ""}
                    </Text>
                  </View>
                  {busy ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <View style={styles.memberActions}>
                      {isCreator &&
                      !isSelf &&
                      member.user_id !== info.created_by ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            memberIsAdmin ? "Remove admin" : "Make admin"
                          }
                          onPress={() =>
                            roleMutation.mutate({
                              member,
                              role: memberIsAdmin ? "member" : "admin",
                            })
                          }
                          style={styles.iconButton}
                        >
                          <Ionicons
                            name={
                              memberIsAdmin
                                ? "shield-checkmark"
                                : "shield-outline"
                            }
                            size={16}
                            color={
                              memberIsAdmin
                                ? colors.primary
                                : colors.mutedForeground
                            }
                          />
                        </Pressable>
                      ) : null}
                      {isAdmin && !isSelf ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${
                            profile?.display_name || profile?.username || "member"
                          }`}
                          onPress={() => confirmRemove(member)}
                          style={styles.iconButton}
                        >
                          <Ionicons
                            name="close"
                            size={16}
                            color={colors.mutedForeground}
                          />
                        </Pressable>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })
          )}

          {isAdmin ? (
            <>
              <Text style={styles.sectionTitle}>Add people</Text>
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
              ) : searchTerm.length >= SEARCH_MIN_CHARS &&
                results.length === 0 ? (
                <Text style={styles.sectionEmpty}>
                  No one found for that search.
                </Text>
              ) : (
                results.map((p) => (
                  <View key={p.id} style={styles.memberRow}>
                    <Avatar
                      url={p.avatar_url}
                      name={p.display_name || p.username}
                      size={40}
                    />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowLabel} numberOfLines={1}>
                        {p.display_name || p.username}
                      </Text>
                      <Text style={styles.memberMeta} numberOfLines={1}>
                        @{p.username}
                      </Text>
                    </View>
                    <Button
                      label="Add"
                      onPress={() => addMutation.mutate(p)}
                      disabled={addMutation.isPending}
                      style={styles.addButton}
                    />
                  </View>
                ))
              )}
            </>
          ) : null}

          <View style={styles.footer}>
            <Button
              label="Report this group"
              variant="outline"
              onPress={() => setReportOpen(true)}
            />
            <Button
              label={leaveMutation.isPending ? "Leaving" : "Leave group"}
              variant="destructive"
              loading={leaveMutation.isPending}
              onPress={confirmLeave}
            />
          </View>
        </>
      ) : null}

      {/* Not destructive: nothing is deleted, the thread just leaves the
          list until a new message resurfaces it, so no danger styling. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close conversation"
        onPress={confirmClose}
        disabled={closeMutation.isPending}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>Close conversation</Text>
          <Text style={styles.rowDescription}>
            Hides it from your messages until a new message arrives.
          </Text>
        </View>
        {closeMutation.isPending ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Ionicons
            name="archive-outline"
            size={16}
            color={colors.mutedForeground}
          />
        )}
      </Pressable>

      <MediaGallerySheet
        visible={galleryOpen}
        conversationId={conversationId}
        onClose={() => setGalleryOpen(false)}
      />

      {reportOpen ? (
        <ReportSheet
          visible
          onClose={() => setReportOpen(false)}
          entityType="conversation"
          entityId={info.id}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingVertical: spacing(2),
    paddingBottom: spacing(10),
  },
  dmHeader: {
    alignItems: "center",
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(4),
    gap: spacing(1),
  },
  dmName: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "700",
    marginTop: spacing(1),
  },
  dmUsername: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  dmProfileButton: {
    marginTop: spacing(2),
    minHeight: 36,
    paddingHorizontal: spacing(5),
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
    gap: spacing(2),
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
  inputDisabled: {
    opacity: 0.6,
  },
  saveButton: {
    alignSelf: "flex-start",
    minHeight: 36,
    paddingHorizontal: spacing(4),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  rowDescription: {
    marginTop: 1,
    color: colors.mutedForeground,
    fontSize: 12.5,
    lineHeight: 17,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  memberMeta: {
    marginTop: 1,
    color: colors.mutedForeground,
    fontSize: 12.5,
  },
  memberActions: {
    flexDirection: "row",
    gap: spacing(1.5),
  },
  iconButton: {
    height: 30,
    width: 30,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    minHeight: 34,
    paddingHorizontal: spacing(3.5),
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
  footer: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(6),
  },
});
