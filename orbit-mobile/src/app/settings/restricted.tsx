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
import { Avatar, Button, EmptyState } from "@/components/ui";
import {
  getRestrictedProfiles,
  unrestrictUser,
} from "@/lib/queries/content-safety";
import type { BlockedProfile } from "@/lib/queries/settings";
import { useAuth } from "@/providers/auth-provider";
import { colors, spacing } from "@/lib/theme";

function RestrictedRow({
  profile,
  onAction,
}: {
  profile: BlockedProfile;
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
        label="Unrestrict"
        variant="outline"
        onPress={onAction}
        style={styles.accountAction}
      />
    </View>
  );
}

export default function RestrictedScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const restrictedKey = ["restricted-profiles", user?.id];

  const restrictedQuery = useQuery({
    queryKey: restrictedKey,
    queryFn: () => getRestrictedProfiles(user!.id),
    enabled: !!user,
  });

  const unrestrictMutation = useMutation({
    mutationFn: (profile: BlockedProfile) =>
      unrestrictUser(user!.id, profile.id),
    onMutate: async (profile) => {
      await queryClient.cancelQueries({ queryKey: restrictedKey });
      const previous =
        queryClient.getQueryData<BlockedProfile[]>(restrictedKey);
      queryClient.setQueryData<BlockedProfile[]>(restrictedKey, (list) =>
        list?.filter((p) => p.id !== profile.id),
      );
      return { previous };
    },
    onError: (_error, profile, context) => {
      queryClient.setQueryData(restrictedKey, context?.previous);
      Alert.alert(`Couldn't unrestrict @${profile.username}`);
    },
    onSettled: () => {
      // Comment lists and read receipts read this cache for enforcement.
      queryClient.invalidateQueries({
        queryKey: ["restricted-users", user?.id],
      });
    },
  });

  if (!user) return null;

  const restricted = restrictedQuery.data ?? [];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Restricted accounts" }} />

      <Text style={styles.explainer}>
        Restricted people can still follow and message you, but their
        comments and read receipts stay hidden from you. Restrict someone
        from their profile.
      </Text>

      <Text style={styles.sectionTitle}>
        Restricted{restrictedQuery.data ? ` (${restricted.length})` : ""}
      </Text>
      {restrictedQuery.isPending ? (
        <View style={styles.sectionPending}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : restrictedQuery.isError ? (
        <EmptyState
          title="Restricted accounts did not load"
          description="Check your connection and try again."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => restrictedQuery.refetch()}
            />
          }
        />
      ) : restricted.length === 0 ? (
        <Text style={styles.sectionEmpty}>
          You haven&apos;t restricted anyone.
        </Text>
      ) : (
        restricted.map((profile) => (
          <RestrictedRow
            key={profile.id}
            profile={profile}
            onAction={() => unrestrictMutation.mutate(profile)}
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
