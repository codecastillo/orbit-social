import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import {
  getCommunities,
  getMyCommunities,
  type Community,
} from "@/lib/queries/communities";
import { formatNumber } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

function CommunityCard({
  community,
  onPress,
}: {
  community: Community;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      {community.cover_url ? (
        <Image
          source={{ uri: community.cover_url }}
          alt=""
          style={styles.cardCover}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={[styles.cardCover, styles.cardCoverFallback]} />
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardAvatar}>
          <Avatar url={community.avatar_url} name={community.name} size={48} />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {community.name}
            </Text>
            {community.is_private ? (
              <View style={styles.privateBadge}>
                <Text style={styles.privateBadgeLabel}>Private</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.cardMembers}>
            {formatNumber(community.member_count)}{" "}
            {community.member_count === 1 ? "member" : "members"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function CommunitiesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const allQuery = useQuery({
    queryKey: ["communities"],
    queryFn: () => getCommunities(),
  });
  const mineQuery = useQuery({
    queryKey: ["my-communities", user?.id],
    queryFn: () => getMyCommunities(user!.id),
    enabled: !!user,
  });

  const myRooms = mineQuery.data ?? [];
  const myRoomIds = new Set(myRooms.map((c) => c.id));
  const otherRooms = (allQuery.data ?? []).filter((c) => !myRoomIds.has(c.id));

  const openRoom = (community: Community) =>
    router.push(`/communities/${community.slug}`);

  if (allQuery.isPending) {
    return (
      <>
        <Stack.Screen options={{ title: "Rooms" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </>
    );
  }

  if (allQuery.isError) {
    return (
      <>
        <Stack.Screen options={{ title: "Rooms" }} />
        <EmptyState
          title="Could not load rooms"
          description="Check your connection and try again."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => allQuery.refetch()}
            />
          }
        />
      </>
    );
  }

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: "Rooms" }} />
      <FlatList
        data={otherRooms}
        keyExtractor={(community) => community.id}
        refreshControl={
          <RefreshControl
            refreshing={allQuery.isRefetching || mineQuery.isRefetching}
            onRefresh={() => {
              allQuery.refetch();
              mineQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          myRooms.length > 0 ? (
            <View>
              <Text style={styles.sectionTitle}>My rooms</Text>
              {myRooms.map((community) => (
                <CommunityCard
                  key={community.id}
                  community={community}
                  onPress={() => openRoom(community)}
                />
              ))}
              {otherRooms.length > 0 ? (
                <Text style={styles.sectionTitle}>All rooms</Text>
              ) : null}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <CommunityCard community={item} onPress={() => openRoom(item)} />
        )}
        ListEmptyComponent={
          myRooms.length === 0 ? (
            <EmptyState
              title="No rooms yet"
              description="Rooms created on Orbit will show up here."
            />
          ) : null
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
    padding: spacing(4),
    paddingBottom: spacing(10),
    flexGrow: 1,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: spacing(3),
    marginTop: spacing(1),
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: "hidden",
    marginBottom: spacing(3),
  },
  cardCover: {
    width: "100%",
    aspectRatio: 4,
  },
  cardCoverFallback: {
    backgroundColor: colors.surfaceElevated,
  },
  cardBody: {
    flexDirection: "row",
    paddingHorizontal: spacing(3.5),
    paddingBottom: spacing(3.5),
  },
  cardAvatar: {
    marginTop: -spacing(5),
    borderRadius: radii.full,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  cardInfo: {
    flex: 1,
    marginLeft: spacing(3),
    marginTop: spacing(2),
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
  },
  cardName: {
    color: colors.foreground,
    fontSize: 15.5,
    fontWeight: "700",
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  privateBadge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
  },
  privateBadgeLabel: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: "600",
  },
  cardMembers: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 2,
  },
});
