import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, Button, EmptyState } from "@/components/ui";
import {
  checkMembership,
  createCommunityPost,
  getCommunityBySlug,
  getCommunityJoinRequests,
  getCommunityPosts,
  getMyJoinRequestStatus,
  joinCommunity,
  setCommunityPostPinned,
  type Community,
  type CommunityPost,
  type CommunityRole,
} from "@/lib/queries/communities";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

const EXCERPT_LENGTH = 140;
const MAX_POST_LENGTH = 500;

// No acceptance table exists, so first-post rules acknowledgement is a
// device-local flag keyed by user + room. Same key shape as the web app.
const rulesAcceptedKey = (userId: string, communityId: string) =>
  `room-rules-accepted:${userId}:${communityId}`;

function excerpt(content: string | null): string {
  if (!content) return "Shared a post";
  return content.length > EXCERPT_LENGTH
    ? `${content.slice(0, EXCERPT_LENGTH).trimEnd()}...`
    : content;
}

function PostRow({
  post,
  onPress,
  onLongPress,
}: {
  post: CommunityPost;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.postRow, pressed && { opacity: 0.7 }]}
    >
      {post.is_pinned ? <Text style={styles.pinnedTag}>PINNED</Text> : null}
      <View style={styles.postMeta}>
        <Text style={styles.postAuthor}>{post.profiles.display_name}</Text>
        <Text style={styles.postTime}>{formatTimeAgo(post.created_at)}</Text>
      </View>
      <Text style={styles.postContent}>{excerpt(post.content)}</Text>
    </Pressable>
  );
}

function RulesList({ rules }: { rules: Community["rules"] }) {
  if (!rules || rules.length === 0) return null;
  return (
    <View style={styles.rulesBlock}>
      <Text style={styles.rulesTitle}>Room rules</Text>
      {rules.map((rule, i) => (
        <View key={i} style={styles.ruleItem}>
          <Text style={styles.ruleTitle}>
            {i + 1}. {rule.title}
          </Text>
          {rule.description ? (
            <Text style={styles.ruleDescription}>{rule.description}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function RoomHeader({
  community,
  joinAction,
  moderationRow,
  composer,
}: {
  community: Community;
  joinAction: React.ReactNode;
  moderationRow: React.ReactNode;
  composer: React.ReactNode;
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
              <Text style={styles.headerMemberCount}>
                {formatNumber(community.member_count)}
              </Text>{" "}
              {community.member_count === 1 ? "member" : "members"}
              {community.is_private ? "  ·  Private" : ""}
            </Text>
          </View>
          {joinAction}
        </View>
        {community.description ? (
          <Text style={styles.headerDescription}>{community.description}</Text>
        ) : null}
        <RulesList rules={community.rules} />
        {moderationRow}
      </View>
      {composer}
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
  const role = (membershipQuery.data ?? null) as CommunityRole | null;
  const isMember = role !== null;
  const isOwnerOrMod = role === "owner" || role === "moderator";

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

  // Owners and mods see how many join requests wait on them (approval rooms).
  const joinRequestsQuery = useQuery({
    queryKey: ["community-join-requests", community?.id],
    queryFn: () => getCommunityJoinRequests(community!.id),
    enabled:
      !!community && isOwnerOrMod && community.join_policy === "approval",
  });
  const pendingCount = joinRequestsQuery.data?.length ?? 0;

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

  // Rules gate: the composer stays locked until this device has recorded an
  // acceptance for this user + room. Rooms without rules skip the gate.
  const rules = community?.rules ?? [];
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  useEffect(() => {
    if (!user || !community) return;
    let cancelled = false;
    AsyncStorage.getItem(rulesAcceptedKey(user.id, community.id))
      .then((v) => {
        if (!cancelled) setRulesAccepted(v === "1");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, community]);

  const acceptRules = () => {
    if (!user || !community) return;
    AsyncStorage.setItem(rulesAcceptedKey(user.id, community.id), "1").catch(
      () => {},
    );
    setRulesAccepted(true);
    setRulesModalOpen(false);
  };

  const [draft, setDraft] = useState("");
  const createPost = useMutation({
    mutationFn: () => createCommunityPost(user!.id, community!.id, draft.trim()),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["community-posts", community?.id] });
    },
    onError: () => Alert.alert("Couldn't post to this room"),
  });

  const togglePin = useMutation({
    mutationFn: ({ post }: { post: CommunityPost }) =>
      setCommunityPostPinned(post.id, !post.is_pinned),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["community-posts", community?.id] }),
    onError: () => Alert.alert("Couldn't update the pin"),
  });

  // Author-only: the posts UPDATE policy is owner-only and there is no
  // moderator pin RPC, so anyone else's pin would silently no-op under RLS.
  const handlePostLongPress = (post: CommunityPost) => {
    if (!user || post.user_id !== user.id) return;
    Alert.alert(
      post.is_pinned ? "Unpin this post?" : "Pin this post?",
      post.is_pinned
        ? "It goes back to its place in the timeline."
        : "Pinned posts show at the top of the room.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: post.is_pinned ? "Unpin" : "Pin",
          onPress: () => togglePin.mutate({ post }),
        },
      ],
    );
  };

  if (communityQuery.isPending) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Room" }} />
        <View style={[styles.cover, styles.coverFallback]} />
        <View style={styles.headerBody}>
          <View style={[styles.headerAvatar, styles.skeletonAvatar]} />
          <View style={[styles.skeletonBar, { width: "50%", marginTop: spacing(3) }]} />
          <View style={[styles.skeletonBar, styles.skeletonBarThin]} />
        </View>
      </View>
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
      style={[
        styles.joinButton,
        joinLabel !== "Join" && styles.joinButtonSecondary,
      ]}
    />
  ) : null;

  const moderationRow = isOwnerOrMod ? (
    <View style={styles.moderationRow}>
      <Button
        label="Members"
        variant="outline"
        onPress={() =>
          router.push({
            pathname: "/communities/members",
            params: { communityId: community.id, role: role ?? "" },
          })
        }
        style={styles.moderationButton}
      />
      {community.join_policy === "approval" ? (
        <Button
          label={pendingCount > 0 ? `Requests (${pendingCount})` : "Requests"}
          variant="outline"
          onPress={() =>
            router.push({
              pathname: "/communities/requests",
              params: { communityId: community.id },
            })
          }
          style={styles.moderationButton}
        />
      ) : null}
    </View>
  ) : null;

  const composer =
    user && isMember ? (
      <View style={styles.composer}>
        {rules.length > 0 && !rulesAccepted ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setRulesModalOpen(true)}
            style={({ pressed }) => [
              styles.rulesGate,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.rulesGateTitle}>
              Read the room rules before your first post
            </Text>
            <Text style={styles.rulesGateSub}>
              Tap to review and accept the {rules.length}{" "}
              {rules.length === 1 ? "rule" : "rules"} of this room.
            </Text>
          </Pressable>
        ) : (
          <View style={styles.composerRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Post to this room..."
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={MAX_POST_LENGTH}
              style={styles.composerInput}
            />
            <Button
              label="Post"
              loading={createPost.isPending}
              disabled={draft.trim().length === 0}
              onPress={() => createPost.mutate()}
              style={styles.composerButton}
            />
          </View>
        )}
      </View>
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
          <RoomHeader
            community={community}
            joinAction={joinAction}
            moderationRow={moderationRow}
            composer={composer}
          />
        }
        renderItem={({ item }) => (
          <PostRow
            post={item}
            onPress={() => router.push(`/post/${item.id}`)}
            onLongPress={
              user && item.user_id === user.id
                ? () => handlePostLongPress(item)
                : undefined
            }
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
              <Text style={styles.postsEmptyText}>No posts in this room yet.</Text>
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
      />

      <Modal
        visible={rulesModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRulesModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Before you post</Text>
            <Text style={styles.modalSub}>
              Posting in {community.name} means agreeing to its rules.
            </Text>
            {rules.map((rule, i) => (
              <View key={i} style={styles.ruleItem}>
                <Text style={styles.ruleTitle}>
                  {i + 1}. {rule.title}
                </Text>
                {rule.description ? (
                  <Text style={styles.ruleDescription}>{rule.description}</Text>
                ) : null}
              </View>
            ))}
            <View style={styles.modalActions}>
              <Button
                label="Not now"
                variant="outline"
                onPress={() => setRulesModalOpen(false)}
                style={styles.modalButton}
              />
              <Button
                label="Accept"
                onPress={acceptRules}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerMembers: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 2,
  },
  headerMemberCount: {
    color: colors.foreground,
    fontWeight: "700",
  },
  joinButton: {
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: spacing(4),
  },
  joinButtonSecondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 0,
  },
  headerDescription: {
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: spacing(3),
  },
  rulesBlock: {
    marginTop: spacing(4),
    gap: spacing(2),
  },
  rulesTitle: {
    color: colors.foreground,
    fontSize: 13.5,
    fontWeight: "700",
    marginBottom: spacing(1),
  },
  ruleItem: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: spacing(3),
  },
  ruleTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
  },
  ruleDescription: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  moderationRow: {
    flexDirection: "row",
    gap: spacing(2),
    marginTop: spacing(4),
  },
  moderationButton: {
    minHeight: 34,
    borderRadius: 10,
    paddingHorizontal: spacing(4),
  },
  composer: {
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(4),
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing(2),
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    color: colors.foreground,
    fontSize: 14,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  composerButton: {
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: spacing(4),
  },
  rulesGate: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: spacing(3.5),
  },
  rulesGateTitle: {
    color: colors.foreground,
    fontSize: 13.5,
    fontWeight: "600",
  },
  rulesGateSub: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 2,
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
  pinnedTag: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: spacing(1),
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
  skeletonAvatar: {
    width: 64,
    height: 64,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonBar: {
    height: 13,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonBarThin: {
    width: "30%",
    height: 10,
    marginTop: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: spacing(5),
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(2),
  },
  modalTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  modalSub: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginBottom: spacing(1),
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing(2),
    marginTop: spacing(2),
  },
  modalButton: {
    minHeight: 38,
    borderRadius: 10,
    paddingHorizontal: spacing(4),
  },
});
