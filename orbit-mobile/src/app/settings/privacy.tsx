import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
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
import { useAuth } from "@/providers/auth-provider";
import { colors, spacing } from "@/lib/theme";

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
