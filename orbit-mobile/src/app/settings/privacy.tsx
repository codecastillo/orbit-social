import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import {
  getBlockedUsers,
  getMutedUsers,
  unblockUser,
  unmuteUser,
  type BlockedProfile,
} from "@/lib/queries/settings";
import {
  getReadReceiptsEnabled,
  getWhoCanMessage,
  setReadReceiptsEnabled,
  setWhoCanMessage,
  type WhoCanMessage,
} from "@/lib/queries/messages";
import { getHideActivity, setHideActivity } from "@/lib/queries/presence";
import { HIDE_ACTIVITY_KEY } from "@/lib/hooks/use-presence";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const WHO_CAN_MESSAGE_OPTIONS: { value: WhoCanMessage; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "following", label: "People you follow" },
  { value: "nobody", label: "No one" },
];

function AccountRow({
  profile,
  actionLabel,
  onAction,
}: {
  profile: BlockedProfile;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.accountRow}>
      <Avatar
        url={profile.avatar_url}
        name={profile.display_name || profile.username}
        size={40}
      />
      <View style={styles.accountBody}>
        <Text style={styles.accountName} numberOfLines={1}>
          {profile.display_name || profile.username}
        </Text>
        <Text style={styles.accountUsername} numberOfLines={1}>
          @{profile.username}
        </Text>
      </View>
      <Button
        label={actionLabel}
        variant="outline"
        onPress={onAction}
        style={styles.accountAction}
      />
    </View>
  );
}

function AccountSection({
  title,
  profiles,
  isPending,
  emptyText,
  actionLabel,
  onAction,
}: {
  title: string;
  profiles: BlockedProfile[] | undefined;
  isPending: boolean;
  emptyText: string;
  actionLabel: string;
  onAction: (profile: BlockedProfile) => void;
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      {isPending ? (
        <View style={styles.sectionPending}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !profiles || profiles.length === 0 ? (
        <Text style={styles.sectionEmpty}>{emptyText}</Text>
      ) : (
        profiles.map((profile) => (
          <AccountRow
            key={profile.id}
            profile={profile}
            actionLabel={actionLabel}
            onAction={() => onAction(profile)}
          />
        ))
      )}
    </>
  );
}

export default function PrivacySettingsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const blockedKey = ["blocked-users", user?.id];
  const mutedKey = ["muted-users", user?.id];

  const blockedQuery = useQuery({
    queryKey: blockedKey,
    queryFn: () => getBlockedUsers(user!.id),
    enabled: !!user,
  });

  const mutedQuery = useQuery({
    queryKey: mutedKey,
    queryFn: () => getMutedUsers(user!.id),
    enabled: !!user,
  });

  const unblockMutation = useMutation({
    mutationFn: (profile: BlockedProfile) => unblockUser(user!.id, profile.id),
    onMutate: async (profile) => {
      await queryClient.cancelQueries({ queryKey: blockedKey });
      const previous = queryClient.getQueryData<BlockedProfile[]>(blockedKey);
      queryClient.setQueryData<BlockedProfile[]>(blockedKey, (list) =>
        list?.filter((p) => p.id !== profile.id),
      );
      return { previous };
    },
    onError: (_error, profile, context) => {
      queryClient.setQueryData(blockedKey, context?.previous);
      Alert.alert(`Couldn't unblock @${profile.username}`);
    },
    // Profiles and DM composers read the id set, not this list.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-ids", user?.id] });
    },
  });

  // Reads degrade to "enabled" until the read_receipts_enabled migration
  // lands, so this row is safe to show either way.
  const receiptsKey = ["read-receipts", user?.id];
  const receiptsQuery = useQuery({
    queryKey: receiptsKey,
    queryFn: () => getReadReceiptsEnabled(user!.id),
    enabled: !!user,
  });

  const receiptsMutation = useMutation({
    mutationFn: (enabled: boolean) => setReadReceiptsEnabled(user!.id, enabled),
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: receiptsKey });
      const previous = queryClient.getQueryData<boolean>(receiptsKey);
      queryClient.setQueryData(receiptsKey, enabled);
      return { previous };
    },
    onError: (_error, _enabled, context) => {
      queryClient.setQueryData(receiptsKey, context?.previous);
      Alert.alert("Couldn't update read receipts");
    },
  });

  // Reciprocal: hiding your activity also hides everyone else's from you,
  // and stops the heartbeat writing at all.
  const hideActivityKey = [HIDE_ACTIVITY_KEY, user?.id];
  const hideActivityQuery = useQuery({
    queryKey: hideActivityKey,
    queryFn: () => getHideActivity(user!.id),
    enabled: !!user,
  });

  const hideActivityMutation = useMutation({
    mutationFn: (hidden: boolean) => setHideActivity(user!.id, hidden),
    onMutate: async (hidden) => {
      await queryClient.cancelQueries({ queryKey: hideActivityKey });
      const previous = queryClient.getQueryData<boolean>(hideActivityKey);
      queryClient.setQueryData(hideActivityKey, hidden);
      return { previous };
    },
    onError: (_error, _hidden, context) => {
      queryClient.setQueryData(hideActivityKey, context?.previous);
      Alert.alert("Couldn't update activity status");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["presence"] });
      queryClient.invalidateQueries({ queryKey: ["presence-many"] });
    },
  });

  const whoCanMessageKey = ["who-can-message", user?.id];
  const whoCanMessageQuery = useQuery({
    queryKey: whoCanMessageKey,
    queryFn: () => getWhoCanMessage(user!.id),
    enabled: !!user,
  });

  const whoCanMessageMutation = useMutation({
    mutationFn: (value: WhoCanMessage) => setWhoCanMessage(user!.id, value),
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: whoCanMessageKey });
      const previous =
        queryClient.getQueryData<WhoCanMessage>(whoCanMessageKey);
      queryClient.setQueryData(whoCanMessageKey, value);
      return { previous };
    },
    onError: (_error, _value, context) => {
      queryClient.setQueryData(whoCanMessageKey, context?.previous);
      Alert.alert("Couldn't update who can message you");
    },
  });

  const unmuteMutation = useMutation({
    mutationFn: (profile: BlockedProfile) => unmuteUser(user!.id, profile.id),
    onMutate: async (profile) => {
      await queryClient.cancelQueries({ queryKey: mutedKey });
      const previous = queryClient.getQueryData<BlockedProfile[]>(mutedKey);
      queryClient.setQueryData<BlockedProfile[]>(mutedKey, (list) =>
        list?.filter((p) => p.id !== profile.id),
      );
      return { previous };
    },
    onError: (_error, profile, context) => {
      queryClient.setQueryData(mutedKey, context?.previous);
      Alert.alert(`Couldn't unmute @${profile.username}`);
    },
    // The feed and clip filters read the id set, not this list.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["muted-ids", user?.id] });
    },
  });

  if (!user) return null;

  const bothPending = blockedQuery.isPending && mutedQuery.isPending;
  const bothFailed = blockedQuery.isError && mutedQuery.isError;

  if (bothPending) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Privacy" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </View>
    );
  }

  if (bothFailed) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Privacy" }} />
        <EmptyState
          title="Privacy settings did not load"
          description="Check your connection and try again."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => {
                blockedQuery.refetch();
                mutedQuery.refetch();
              }}
            />
          }
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Privacy" }} />

      <Text style={styles.sectionTitle}>Activity</Text>
      <View style={styles.toggleRow}>
        <View style={styles.toggleBody}>
          <Text style={styles.toggleLabel}>Hide activity status</Text>
          <Text style={styles.toggleHint}>
            Stop showing when you were last online. Turn it on and you will not
            see anyone else&apos;s either.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Hide activity status"
          value={hideActivityQuery.data ?? false}
          onValueChange={(hidden) => hideActivityMutation.mutate(hidden)}
          disabled={hideActivityQuery.isPending}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.foreground}
        />
      </View>

      <Text style={styles.sectionTitle}>Messages</Text>
      <View style={styles.toggleRow}>
        <View style={styles.toggleBody}>
          <Text style={styles.toggleLabel}>Read receipts</Text>
          <Text style={styles.toggleHint}>
            Show people when you have seen their messages. Turn it off and you
            will not see theirs either.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Read receipts"
          value={receiptsQuery.data ?? true}
          onValueChange={(enabled) => receiptsMutation.mutate(enabled)}
          disabled={receiptsQuery.isPending}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.foreground}
        />
      </View>

      <View style={styles.choiceBlock}>
        <Text style={styles.toggleLabel}>Who can message you</Text>
        <Text style={styles.toggleHint}>
          First contact only. A conversation you have replied to stays open.
          Messages from people you do not follow wait in Requests.
        </Text>
        <View style={styles.choices}>
          {WHO_CAN_MESSAGE_OPTIONS.map((option) => {
            const active =
              (whoCanMessageQuery.data ?? "everyone") === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => whoCanMessageMutation.mutate(option.value)}
                style={[styles.choice, active && styles.choiceActive]}
              >
                <Text
                  style={[
                    styles.choiceLabel,
                    active && styles.choiceLabelActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <AccountSection
        title="Blocked accounts"
        profiles={blockedQuery.data}
        isPending={blockedQuery.isPending}
        emptyText="You haven't blocked anyone."
        actionLabel="Unblock"
        onAction={(profile) => unblockMutation.mutate(profile)}
      />

      <AccountSection
        title="Muted accounts"
        profiles={mutedQuery.data}
        isPending={mutedQuery.isPending}
        emptyText="You haven't muted anyone."
        actionLabel="Unmute"
        onAction={(profile) => unmuteMutation.mutate(profile)}
      />
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
  sectionPending: {
    paddingVertical: spacing(4),
  },
  sectionEmpty: {
    color: colors.mutedForeground,
    fontSize: 13,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  toggleBody: {
    flex: 1,
    minWidth: 0,
  },
  toggleLabel: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  toggleHint: {
    marginTop: 2,
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 16,
  },
  choiceBlock: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(2),
    marginTop: spacing(3),
  },
  choice: {
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
  },
  choiceActive: {
    backgroundColor: colors.primary,
  },
  choiceLabel: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "600",
  },
  choiceLabelActive: {
    color: colors.foreground,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  accountBody: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  accountUsername: {
    marginTop: 1,
    color: colors.mutedForeground,
    fontSize: 12.5,
  },
  accountAction: {
    minHeight: 34,
    paddingHorizontal: spacing(3.5),
  },
});
