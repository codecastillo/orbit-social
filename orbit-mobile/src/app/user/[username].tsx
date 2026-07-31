import { Alert, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Button, EmptyState } from "@/components/ui";
import {
  ProfileActionButton,
  ProfileHeader,
  ProfileHeaderSkeleton,
} from "@/components/profile-header";
import { ProfileContent } from "@/components/profile-tabs";
import { PostBellButton } from "@/components/post-bell-button";
import { startDmConversation } from "@/lib/queries/marketplace";
import { restrictUser, unrestrictUser } from "@/lib/queries/content-safety";
import { useRestrictedIds } from "@/lib/hooks/use-content-safety";
import {
  checkFollowing,
  followUser,
  getProfileByUsername,
  getUserRecentPosts,
  unfollowUser,
  type Profile,
} from "@/lib/queries/profiles";
import { colors } from "@/lib/theme";

const TITLE_STYLE = { fontSize: 17, fontWeight: "700" } as const;

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

  const openDm = useMutation({
    mutationFn: () => startDmConversation(profile!.id),
    onSuccess: (conversationId) => {
      router.push(`/conversation/${conversationId}`);
    },
  });

  const restrictedQuery = useRestrictedIds();
  const isRestricted = !!profile && (restrictedQuery.data?.has(profile.id) ?? false);

  const toggleRestrict = useMutation({
    mutationFn: (nowRestricted: boolean) =>
      nowRestricted
        ? restrictUser(user!.id, profile!.id)
        : unrestrictUser(user!.id, profile!.id),
    onSuccess: (_data, nowRestricted) => {
      if (nowRestricted) {
        Alert.alert(
          "Restricted",
          `@${profile?.username}'s comments and read receipts are now hidden from you.`,
        );
      }
    },
    onError: () => Alert.alert(`Couldn't update @${profile?.username}`),
    onSettled: () => {
      // Comment lists and read receipts read this cache for enforcement.
      queryClient.invalidateQueries({ queryKey: ["restricted-users", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["restricted-profiles", user?.id] });
    },
  });

  if (profileQuery.isPending) {
    return (
      <View style={styles.flex}>
        <Stack.Screen
          options={{
            title: username ? `@${username}` : "Profile",
            headerTitleStyle: TITLE_STYLE,
          }}
        />
        <ProfileHeaderSkeleton />
      </View>
    );
  }

  if (profileQuery.isError) {
    return (
      <>
        <Stack.Screen
          options={{ title: "Profile", headerTitleStyle: TITLE_STYLE }}
        />
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
        <Stack.Screen
          options={{ title: "Profile", headerTitleStyle: TITLE_STYLE }}
        />
        <EmptyState
          title="Profile not found"
          description={`No one goes by @${username} on Orbit.`}
        />
      </>
    );
  }

  const isFollowing = followingQuery.data ?? false;
  const actions =
    !isOwnProfile && user ? (
      <>
        <ProfileActionButton
          label={isFollowing ? "Following" : "Follow"}
          variant={isFollowing ? "secondary" : "primary"}
          disabled={followingQuery.isPending}
          onPress={() => toggleFollow.mutate(!isFollowing)}
        />
        {isFollowing && <PostBellButton creatorId={profile.id} />}
        <ProfileActionButton
          label="Message"
          loading={openDm.isPending}
          onPress={() => openDm.mutate()}
        />
        <ProfileActionButton
          label={isRestricted ? "Unrestrict" : "Restrict"}
          disabled={restrictedQuery.isPending || toggleRestrict.isPending}
          onPress={() => toggleRestrict.mutate(!isRestricted)}
        />
      </>
    ) : undefined;

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: `@${profile.username}`,
          headerTitleStyle: TITLE_STYLE,
        }}
      />
      <ProfileContent
        header={<ProfileHeader profile={profile} actions={actions} />}
        posts={postsQuery.data}
        isPending={postsQuery.isPending}
        isError={postsQuery.isError}
        onRetry={() => postsQuery.refetch()}
        userId={profile.id}
        username={profile.username}
        onPressPost={(postId) => router.push(`/post/${postId}`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
