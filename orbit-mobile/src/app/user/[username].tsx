import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Button, Centered, EmptyState } from "@/components/ui";
import { ProfileHeader, ProfilePostRow } from "@/components/profile-header";
import {
  checkFollowing,
  followUser,
  getProfileByUsername,
  getUserRecentPosts,
  unfollowUser,
  type Profile,
} from "@/lib/queries/profiles";
import { colors, spacing } from "@/lib/theme";

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile", "username", username],
    queryFn: () => getProfileByUsername(username),
    enabled: !!username,
  });
  const profile = profileQuery.data;
  const isOwnProfile = !!profile && profile.id === user?.id;

  const followingQuery = useQuery({
    queryKey: ["following", user?.id, profile?.id],
    queryFn: () => checkFollowing(user!.id, profile!.id),
    enabled: !!user && !!profile && !isOwnProfile,
  });

  const postsQuery = useQuery({
    queryKey: ["profile-posts", profile?.id],
    queryFn: () => getUserRecentPosts(profile!.id),
    enabled: !!profile,
  });

  const followKey = ["following", user?.id, profile?.id];
  const profileKey = ["profile", "username", username];

  const toggleFollow = useMutation({
    mutationFn: (nowFollowing: boolean) =>
      nowFollowing
        ? followUser(user!.id, profile!.id)
        : unfollowUser(user!.id, profile!.id),
    onMutate: async (nowFollowing) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: followKey }),
        queryClient.cancelQueries({ queryKey: profileKey }),
      ]);
      const previousFollowing = queryClient.getQueryData<boolean>(followKey);
      const previousProfile = queryClient.getQueryData<Profile>(profileKey);
      queryClient.setQueryData(followKey, nowFollowing);
      if (previousProfile) {
        queryClient.setQueryData<Profile>(profileKey, {
          ...previousProfile,
          follower_count: Math.max(
            previousProfile.follower_count + (nowFollowing ? 1 : -1),
            0,
          ),
        });
      }
      return { previousFollowing, previousProfile };
    },
    onError: (_error, _nowFollowing, context) => {
      queryClient.setQueryData(followKey, context?.previousFollowing);
      if (context?.previousProfile) {
        queryClient.setQueryData(profileKey, context.previousProfile);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: followKey });
      queryClient.invalidateQueries({ queryKey: profileKey });
    },
  });

  if (profileQuery.isPending) {
    return (
      <>
        <Stack.Screen options={{ title: username ? `@${username}` : "Profile" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </>
    );
  }

  if (profileQuery.isError) {
    return (
      <>
        <Stack.Screen options={{ title: "Profile" }} />
        <EmptyState
          title="Could not load this profile"
          description="Check your connection and try again."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => profileQuery.refetch()}
            />
          }
        />
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <Stack.Screen options={{ title: "Profile" }} />
        <EmptyState
          title="Profile not found"
          description={`No one goes by @${username} on Orbit.`}
        />
      </>
    );
  }

  const isFollowing = followingQuery.data ?? false;
  const followAction =
    !isOwnProfile && user ? (
      <Button
        label={isFollowing ? "Following" : "Follow"}
        variant={isFollowing ? "outline" : "primary"}
        disabled={followingQuery.isPending}
        onPress={() => toggleFollow.mutate(!isFollowing)}
      />
    ) : undefined;

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: `@${profile.username}` }} />
      <FlatList
        data={postsQuery.data ?? []}
        keyExtractor={(post) => post.id}
        ListHeaderComponent={<ProfileHeader profile={profile} action={followAction} />}
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
            <View style={styles.postsLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : postsQuery.isError ? (
            <View style={styles.postsError}>
              <Text style={styles.postsErrorText}>Could not load posts.</Text>
              <Button
                label="Retry"
                variant="outline"
                onPress={() => postsQuery.refetch()}
              />
            </View>
          ) : (
            <View style={styles.postsLoading}>
              <Text style={styles.postsEmptyText}>No posts yet.</Text>
            </View>
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
    paddingBottom: spacing(8),
  },
  postsLoading: {
    padding: spacing(8),
    alignItems: "center",
  },
  postsError: {
    padding: spacing(8),
    alignItems: "center",
    gap: spacing(3),
  },
  postsErrorText: {
    color: colors.mutedForeground,
    fontSize: 13.5,
  },
  postsEmptyText: {
    color: colors.mutedForeground,
    fontSize: 13.5,
  },
});
