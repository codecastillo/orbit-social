import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { Button, Centered, EmptyState } from "@/components/ui";
import { ProfileHeader, ProfilePostRow } from "@/components/profile-header";
import { ProfileOnboarding } from "@/components/profile-onboarding";
import {
  getOwnProfile,
  getUserRecentPosts,
  hasPlaceholderUsername,
} from "@/lib/queries/profiles";
import { colors, radii, spacing } from "@/lib/theme";

export default function OwnProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
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

  const postsQuery = useQuery({
    queryKey: ["profile-posts", user?.id],
    queryFn: () => getUserRecentPosts(user!.id),
    enabled: !!user && !!profile,
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
    <View style={styles.flex}>
      <FlatList
        data={postsQuery.data ?? []}
        keyExtractor={(post) => post.id}
        ListHeaderComponent={
          <ProfileHeader
            profile={profile}
            action={
              <Button
                label="Edit profile"
                variant="outline"
                // Route file exists but typed routes only regenerate on the
                // next `expo start`, hence the cast.
                onPress={() => router.push("/edit-profile" as Href)}
              />
            }
          />
        }
        renderItem={({ item }) => (
          <ProfilePostRow
            authorName={profile.display_name}
            content={item.content}
            createdAt={item.created_at}
            onPress={() => router.push(`/post/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          postsQuery.isPending ? (
            <View style={styles.postsState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : postsQuery.isError ? (
            <View style={styles.postsError}>
              <Text style={styles.postsStateText}>Could not load your posts.</Text>
              <Button
                label="Retry"
                variant="outline"
                onPress={() => postsQuery.refetch()}
              />
            </View>
          ) : (
            <View style={styles.postsState}>
              <Text style={styles.postsStateText}>
                Nothing posted yet. Your posts land here.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.email}>{user.email}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={handleSignOut}
              style={({ pressed }) => [
                styles.signOut,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.signOutLabel}>Sign out</Text>
            </Pressable>
          </View>
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
    paddingBottom: spacing(8),
  },
  postsState: {
    padding: spacing(8),
    alignItems: "center",
  },
  postsError: {
    padding: spacing(8),
    alignItems: "center",
    gap: spacing(3),
  },
  postsStateText: {
    color: colors.mutedForeground,
    fontSize: 13.5,
    textAlign: "center",
  },
  footer: {
    padding: spacing(4),
    marginTop: spacing(4),
  },
  email: {
    color: colors.textFaint,
    fontSize: 12.5,
    marginBottom: spacing(3),
  },
  signOut: {
    minHeight: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutLabel: {
    color: colors.destructive,
    fontSize: 14,
    fontWeight: "600",
  },
});
