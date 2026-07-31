import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { Button, Centered, EmptyState } from "@/components/ui";
import { ProfileHeader } from "@/components/profile-header";
import { ProfileOnboarding } from "@/components/profile-onboarding";
import { getOwnProfile, hasPlaceholderUsername } from "@/lib/queries/profiles";
import { colors, spacing } from "@/lib/theme";

export default function OwnProfileScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: profile,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getOwnProfile(user!.id),
    enabled: !!user,
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    // Drop every cached query so the next account starts clean.
    queryClient.clear();
    // The AuthGate redirects to the login screen once the session clears.
  }

  if (!user || isPending) {
    return (
      <Centered>
        <ActivityIndicator color={colors.primary} />
      </Centered>
    );
  }

  if (isError || !profile) {
    return (
      <EmptyState
        title="Could not load your profile"
        description="Check your connection and try again."
        action={<Button label="Retry" variant="outline" onPress={() => refetch()} />}
      />
    );
  }

  if (hasPlaceholderUsername(profile)) {
    return <ProfileOnboarding profile={profile} />;
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <ProfileHeader profile={profile} />
      <View style={styles.actions}>
        <Text style={styles.email}>{user.email}</Text>
        <Button label="Sign out" variant="outline" onPress={handleSignOut} />
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
    paddingBottom: spacing(8),
  },
  actions: {
    padding: spacing(4),
  },
  email: {
    color: colors.textFaint,
    fontSize: 12.5,
    marginBottom: spacing(3),
  },
});
