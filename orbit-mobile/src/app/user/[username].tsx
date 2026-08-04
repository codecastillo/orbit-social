import { useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
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
import { Button, EmptyState } from "@/components/ui";
import {
  ProfileActionButton,
  ProfileHeader,
  ProfileHeaderSkeleton,
} from "@/components/profile-header";
import { ProfileContent } from "@/components/profile-tabs";
import { HighlightsRow } from "@/components/highlights-row";
import { PostBellButton } from "@/components/post-bell-button";
import { ReportSheet } from "@/components/report-sheet";
import { startDmConversation } from "@/lib/queries/marketplace";
import { restrictUser, unrestrictUser } from "@/lib/queries/content-safety";
import {
  useBlockedIds,
  useMutedIds,
  useRestrictedIds,
} from "@/lib/hooks/use-content-safety";
import {
  BLOCK_INVALIDATION_KEYS,
  blockUser,
  muteUser,
  unblockUser,
  unmuteUser,
} from "@/lib/queries/settings";
import {
  BLOCKED_FOLLOW_MESSAGE,
  isBlockedFollowError,
} from "@/lib/blocked-error";
import {
  countVisiblePosts,
  findCurrentUsername,
  getFollowState,
  getProfileByUsername,
  getUserRecentPosts,
  toggleFollowState,
  type FollowState,
  type Profile,
} from "@/lib/queries/profiles";
import { colors, radii, spacing } from "@/lib/theme";

const TITLE_STYLE = { fontSize: 17, fontWeight: "700" } as const;

/**
 * A private account never gets a direct follow, so the Follow tap lands on
 * "requested" instead. Knowing the target's privacy up front keeps the
 * optimistic update honest.
 */
function nextFollowState(current: FollowState, isPrivate: boolean): FollowState {
  if (current !== "none") return "none";
  return isPrivate ? "requested" : "following";
}

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile", "username", username],
    queryFn: () => getProfileByUsername(username),
    enabled: !!username,
    // Someone else's bio and counts are stable enough to reuse for a few
    // minutes; revisiting a profile should not re-skeleton it.
    staleTime: 1000 * 60 * 5,
  });
  const profile = profileQuery.data;
  const isOwnProfile = !!profile && profile.id === user?.id;

  // A handle that resolves to nobody may just be an old one: renames are
  // recorded, so the route swaps itself for the current handle instead of
  // dead-ending on "not found".
  const renamedQuery = useQuery({
    queryKey: ["username-redirect", username],
    queryFn: () => findCurrentUsername(username),
    enabled: profileQuery.isSuccess && !profileQuery.data,
  });
  const renamedTo = renamedQuery.data;

  useEffect(() => {
    if (renamedTo) router.replace(`/user/${renamedTo}`);
  }, [renamedTo, router]);

  const followStateQuery = useQuery({
    queryKey: ["follow-state", user?.id, profile?.id],
    queryFn: () => getFollowState(user!.id, profile!.id),
    enabled: !!user && !!profile && !isOwnProfile,
  });
  const followState = followStateQuery.data ?? "none";
  // A pending request unlocks nothing: only a confirmed follow does. The
  // posts policy enforces this server-side too, so the gate is about telling
  // the viewer why the grid is missing rather than about hiding anything.
  const isLocked =
    !!profile && profile.is_private === true && !isOwnProfile && followState !== "following";

  // Only the viewer's own block rows are readable, so this answers "did I
  // block them" and nothing else. The reverse direction stays invisible by
  // design and is never inferred from an empty profile.
  const blockedQuery = useBlockedIds();
  const viewerBlocked =
    !!profile && (blockedQuery.data?.has(profile.id) ?? false);

  // What the server will actually serve for this account. post_count is a
  // counter column, so it survives the posts policy; a positive count with
  // nothing readable means the content is being withheld from this viewer,
  // which is all we can honestly say about it.
  const visiblePostsQuery = useQuery({
    queryKey: ["visible-post-count", profile?.id, user?.id],
    queryFn: () => countVisiblePosts(profile!.id),
    enabled:
      !!user &&
      !!profile &&
      !isOwnProfile &&
      !viewerBlocked &&
      profile.is_private !== true &&
      profile.post_count > 0,
  });
  // A paused account keeps a readable profile row while the posts policy
  // withholds its content, so it gets the same neutral state as a viewer
  // whose posts are being withheld for any other reason.
  const isUnavailable =
    visiblePostsQuery.data === 0 || (!isOwnProfile && !!profile?.deactivated_at);

  const postsQuery = useQuery({
    queryKey: ["profile-posts", profile?.id],
    queryFn: () => getUserRecentPosts(profile!.id),
    enabled: !!profile && !viewerBlocked && !isUnavailable && !isLocked,
    staleTime: 1000 * 60 * 3,
  });

  const blockedIdsKey = ["blocked-ids", user?.id];

  const block = useMutation({
    mutationFn: () => blockUser(user!.id, profile!.id),
    // Swap the profile to its blocked state on tap: the id set drives that
    // branch, and the server work behind it is not instant.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: blockedIdsKey });
      const previous = queryClient.getQueryData<Set<string>>(blockedIdsKey);
      queryClient.setQueryData<Set<string>>(blockedIdsKey, (ids) =>
        new Set(ids ?? []).add(profile!.id),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(blockedIdsKey, context?.previous);
      Alert.alert(`Couldn't block @${profile?.username}`);
    },
    onSettled: () => {
      for (const key of BLOCK_INVALIDATION_KEYS) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  const confirmBlock = () => {
    Alert.alert(
      `Block @${profile?.username}?`,
      "They will not see your posts or be able to message you, you will not see theirs, and you will both stop following each other. You can undo this in Settings, Privacy.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Block", style: "destructive", onPress: () => block.mutate() },
      ],
    );
  };

  const unblock = useMutation({
    mutationFn: () => unblockUser(user!.id, profile!.id),
    onError: () => Alert.alert(`Couldn't unblock @${profile?.username}`),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-ids", user?.id] });
      // Their posts come back through RLS, so the profile lists need a refetch.
      queryClient.invalidateQueries({ queryKey: ["profile-posts", profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-clips", profile?.id] });
      queryClient.invalidateQueries({
        queryKey: ["visible-post-count", profile?.id, user?.id],
      });
    },
  });

  const followKey = ["follow-state", user?.id, profile?.id];
  const profileKey = ["profile", "username", username];

  const toggleFollow = useMutation({
    mutationFn: (current: FollowState) =>
      toggleFollowState(
        user!.id,
        profile!.id,
        current,
        profile!.is_private === true,
      ),
    onMutate: async (current) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: followKey }),
        queryClient.cancelQueries({ queryKey: profileKey }),
      ]);
      const previousFollowState =
        queryClient.getQueryData<FollowState>(followKey);
      const previousProfile = queryClient.getQueryData<Profile>(profileKey);
      const next = nextFollowState(current, profile!.is_private === true);
      queryClient.setQueryData(followKey, next);
      // Only a confirmed follow moves the counter; a pending request does not.
      const delta =
        (next === "following" ? 1 : 0) - (current === "following" ? 1 : 0);
      if (previousProfile && delta !== 0) {
        queryClient.setQueryData<Profile>(profileKey, {
          ...previousProfile,
          follower_count: Math.max(previousProfile.follower_count + delta, 0),
        });
      }
      return { previousFollowState, previousProfile };
    },
    onError: (error, current, context) => {
      queryClient.setQueryData(followKey, context?.previousFollowState);
      if (context?.previousProfile) {
        queryClient.setQueryData(profileKey, context.previousProfile);
      }
      if (current === "none" && isBlockedFollowError(error)) {
        Alert.alert(BLOCKED_FOLLOW_MESSAGE);
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

  const [reportOpen, setReportOpen] = useState(false);

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

  const mutedQuery = useMutedIds();
  const isMuted = !!profile && (mutedQuery.data?.has(profile.id) ?? false);

  const toggleMute = useMutation({
    mutationFn: (nowMuted: boolean) =>
      nowMuted ? muteUser(user!.id, profile!.id) : unmuteUser(user!.id, profile!.id),
    onError: () => Alert.alert(`Couldn't update @${profile?.username}`),
    onSettled: () => {
      // Mutes are filtered client-side, so the id set and every list that
      // reads it have to refetch.
      queryClient.invalidateQueries({ queryKey: ["muted-ids", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["muted-users", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["clips"] });
    },
  });

  const confirmMute = () => {
    Alert.alert(
      `Mute @${profile?.username}?`,
      "Their posts and clips stop showing up for you. They can still follow you, see your posts, and message you, and they are not told.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Mute", onPress: () => toggleMute.mutate(true) },
      ],
    );
  };

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
    // Hold the skeleton while the rename lookup runs, and through the replace
    // itself, so a healed link never flashes "not found" on its way.
    if (renamedQuery.isPending || renamedTo) {
      return (
        <View style={styles.flex}>
          <Stack.Screen
            options={{ title: "Profile", headerTitleStyle: TITLE_STYLE }}
          />
          <ProfileHeaderSkeleton />
        </View>
      );
    }
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

  // Blocked or withheld: the shell stays so the account still reads as a
  // real person, but there is nothing below it worth rendering. Unblocking
  // is the only action that makes sense from the blocked side; the neutral
  // copy names no one, since the reverse block is invisible to us.
  if (viewerBlocked || isUnavailable) {
    return (
      <View style={styles.flex}>
        <Stack.Screen
          options={{
            title: `@${profile.username}`,
            headerTitleStyle: TITLE_STYLE,
          }}
        />
        <ProfileHeader profile={profile} />
        <EmptyState
          title={
            viewerBlocked
              ? "You blocked this account"
              : "This account is unavailable"
          }
          description={
            viewerBlocked
              ? `You cannot see @${profile.username}'s posts, and they cannot see yours, follow you, or message you.`
              : "There is nothing here for you to see right now."
          }
          action={
            viewerBlocked ? (
              <Button
                label="Unblock"
                variant="outline"
                loading={unblock.isPending}
                onPress={() => unblock.mutate()}
              />
            ) : undefined
          }
        />
      </View>
    );
  }

  const isFollowing = followState === "following";
  const actions =
    !isOwnProfile && user ? (
      <>
        <ProfileActionButton
          label={
            followState === "following"
              ? "Following"
              : followState === "requested"
                ? "Requested"
                : "Follow"
          }
          variant={followState === "none" ? "primary" : "secondary"}
          disabled={followStateQuery.isPending}
          onPress={() => toggleFollow.mutate(followState)}
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
        <ProfileActionButton
          label={isMuted ? "Unmute" : "Mute"}
          disabled={mutedQuery.isPending || toggleMute.isPending}
          onPress={() => (isMuted ? toggleMute.mutate(false) : confirmMute())}
        />
        <ProfileActionButton
          label="Block"
          disabled={blockedQuery.isPending || block.isPending}
          onPress={confirmBlock}
        />
        <ProfileActionButton label="Report" onPress={() => setReportOpen(true)} />
      </>
    ) : undefined;

  const profileHeader = (
    <>
      <ProfileHeader
        profile={profile}
        actions={actions}
        onPressFollowers={() =>
          router.push(
            `/user/follows?userId=${profile.id}&username=${profile.username}&tab=followers`,
          )
        }
        onPressFollowing={() =>
          router.push(
            `/user/follows?userId=${profile.id}&username=${profile.username}&tab=following`,
          )
        }
      />
      {/* Highlights are posts too, so they sit behind the same gate. */}
      {!isLocked && <HighlightsRow userId={profile.id} isOwner={isOwnProfile} />}
    </>
  );

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: `@${profile.username}`,
          headerTitleStyle: TITLE_STYLE,
        }}
      />
      {isLocked ? (
        // A pull here is how someone finds out their follow request was
        // approved without leaving and coming back.
        <ScrollView
          contentContainerStyle={styles.lockedBody}
          refreshControl={
            <RefreshControl
              refreshing={followStateQuery.isRefetching}
              onRefresh={() => {
                profileQuery.refetch();
                followStateQuery.refetch();
              }}
              tintColor={colors.mutedForeground}
            />
          }
        >
          {profileHeader}
          <View style={styles.lockCard}>
            <Text style={styles.lockTitle}>This account is private.</Text>
            <Text style={styles.lockBody}>
              {followState === "requested"
                ? `Your request is waiting on @${profile.username}.`
                : "Follow to see their posts."}
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ProfileContent
          header={profileHeader}
          posts={postsQuery.data}
          isPending={postsQuery.isPending}
          isError={postsQuery.isError}
          onRetry={() => postsQuery.refetch()}
          userId={profile.id}
          username={profile.username}
          onPressPost={(postId) => router.push(`/post/${postId}`)}
          onRefresh={() =>
            Promise.all([profileQuery.refetch(), followStateQuery.refetch()])
          }
        />
      )}
      {/* Same entity_type and target as the web profile report dialog. */}
      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        entityType="profile"
        entityId={profile.id}
        reportedUserId={profile.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  lockedBody: {
    paddingBottom: spacing(10),
  },
  lockCard: {
    margin: spacing(4),
    padding: spacing(6),
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  lockTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  lockBody: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: spacing(1.5),
    textAlign: "center",
  },
});
