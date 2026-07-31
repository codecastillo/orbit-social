import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import {
  checkMembership,
  getCommunityBySlug,
  getCommunityPosts,
  getMyJoinRequestStatus,
  joinCommunity,
  type Community,
  type CommunityPost,
} from "@/lib/queries/communities";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

const EXCERPT_LENGTH = 140;

function excerpt(content: string | null): string {
  if (!content) return "Shared a post";
  return content.length > EXCERPT_LENGTH
    ? `${content.slice(0, EXCERPT_LENGTH).trimEnd()}...`
    : content;
}

function PostRow({ post, onPress }: { post: CommunityPost; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.postRow, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.postMeta}>
        <Text style={styles.postAuthor}>{post.profiles.display_name}</Text>
        <Text style={styles.postTime}>{formatTimeAgo(post.created_at)}</Text>
      </View>
      <Text style={styles.postContent}>{excerpt(post.content)}</Text>
    </Pressable>
  );
}

function RoomHeader({
  community,
  joinAction,
}: {
  community: Community;
  joinAction: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      {community.cover_url ? (
        <Image
          source={{ uri: community.cover_url }}
          alt=""
          style={styles.cover}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={[styles.cover, styles.coverFallback]} />
      )}
      <View style={styles.headerBody}>
        <View style={styles.headerAvatar}>
          <Avatar url={community.avatar_url} name={community.name} size={64} />
        </View>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerTitleInfo}>
            <Text style={styles.headerName}>{community.name}</Text>
            <Text style={styles.headerMembers}>
              {formatNumber(community.member_count)}{" "}
              {community.member_count === 1 ? "member" : "members"}
              {community.is_private ? "  ·  Private" : ""}
            </Text>
          </View>
          {joinAction}
        </View>
        {community.description ? (
          <Text style={styles.headerDescription}>{community.description}</Text>
        ) : null}
      </View>
      <Text style={styles.sectionTitle}>Posts</Text>
    </View>
  );
}

export default function CommunityDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const communityQuery = useQuery({
    queryKey: ["community", slug],
    queryFn: () => getCommunityBySlug(slug),
    enabled: !!slug,
  });
  const community = communityQuery.data;

  const membershipQuery = useQuery({
    queryKey: ["community-membership", community?.id, user?.id],
    queryFn: () => checkMembership(community!.id, user!.id),
    enabled: !!community && !!user,
  });
  const role = membershipQuery.data ?? null;
  const isMember = role !== null;

  const requestKey = ["community-join-request", community?.id, user?.id];
  const requestQuery = useQuery({
    queryKey: requestKey,
    queryFn: () => getMyJoinRequestStatus(community!.id, user!.id),
    enabled:
      !!community && !!user && !isMember && community.join_policy === "approval",
  });
  const hasPendingRequest = requestQuery.data === "pending";

  const postsQuery = useQuery({
    queryKey: ["community-posts", community?.id],
    queryFn: () => getCommunityPosts(community!.id),
    enabled: !!community,
  });

  const join = useMutation({
    mutationFn: () => joinCommunity(community!.id),
    onSuccess: (result) => {
      if (result === "joined") {
        queryClient.invalidateQueries({
          queryKey: ["community-membership", community?.id, user?.id],
        });
        queryClient.invalidateQueries({ queryKey: ["community", slug] });
        queryClient.invalidateQueries({ queryKey: ["my-communities", user?.id] });
      } else if (result === "requested") {
        queryClient.setQueryData(requestKey, "pending");
      }
    },
  });

  if (communityQuery.isPending) {
    return (
      <>
        <Stack.Screen options={{ title: "Room" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </>
    );
  }

  if (communityQuery.isError || !community) {
    return (
      <>
        <Stack.Screen options={{ title: "Room" }} />
        <EmptyState
          title="Could not load this room"
          description="It may have been deleted, or your connection dropped."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => communityQuery.refetch()}
            />
          }
        />
      </>
    );
  }

  const joinLabel = (() => {
    if (isMember) return "Joined";
    if (hasPendingRequest || join.data === "requested") return "Requested";
    if (community.join_policy === "invite" || join.data === "invite_only") {
      return "Invite only";
    }
    return "Join";
  })();
  const joinDisabled = joinLabel !== "Join" || membershipQuery.isPending;

  const joinAction = user ? (
    <Button
      label={joinLabel}
      variant={joinLabel === "Join" ? "primary" : "outline"}
      loading={join.isPending}
      disabled={joinDisabled}
      onPress={() => join.mutate()}
    />
  ) : null;

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: community.name }} />
      <FlatList
        data={postsQuery.data ?? []}
        keyExtractor={(post) => post.id}
        refreshControl={
          <RefreshControl
            refreshing={communityQuery.isRefetching || postsQuery.isRefetching}
            onRefresh={() => {
              communityQuery.refetch();
              postsQuery.refetch();
              membershipQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <RoomHeader community={community} joinAction={joinAction} />
        }
        renderItem={({ item }) => (
          <PostRow post={item} onPress={() => router.push(`/post/${item.id}`)} />
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
              <Text style={styles.postsEmptyText}>No posts in this room yet.</Text>
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
    paddingBottom: spacing(10),
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cover: {
    width: "100%",
    aspectRatio: 4,
  },
  coverFallback: {
    backgroundColor: colors.surfaceElevated,
  },
  headerBody: {
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(4),
  },
  headerAvatar: {
    alignSelf: "flex-start",
    marginTop: -spacing(7),
    borderRadius: radii.full,
    borderWidth: 3,
    borderColor: colors.background,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing(2),
    gap: spacing(3),
  },
  headerTitleInfo: {
    flex: 1,
  },
  headerName: {
    color: colors.foreground,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  headerMembers: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 2,
  },
  headerDescription: {
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: spacing(3),
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.3,
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(3),
  },
  postRow: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  postMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  postAuthor: {
    color: colors.foreground,
    fontSize: 13.5,
    fontWeight: "600",
  },
  postTime: {
    color: colors.textFaint,
    fontSize: 12,
  },
  postContent: {
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 4,
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
