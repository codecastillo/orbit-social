import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, Button, EmptyState } from "@/components/ui";
import {
  getCommunities,
  getMyCommunities,
  type Community,
} from "@/lib/queries/communities";
import { formatNumber } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

const SKELETON_CARDS = 4;

function CommunityCard({
  community,
  joined,
  onPress,
}: {
  community: Community;
  joined: boolean;
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
              <Text style={styles.privateLabel}>Private</Text>
            ) : null}
          </View>
          <Text style={styles.cardMembers}>
            {formatNumber(community.member_count)}{" "}
            {community.member_count === 1 ? "member" : "members"}
          </Text>
        </View>
        <View style={[styles.stateChip, joined && styles.stateChipJoined]}>
          <Text style={[styles.stateChipLabel, joined && styles.stateChipLabelJoined]}>
            {joined ? "Joined" : "Join"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function RoomsSkeleton() {
  return (
    <View style={styles.listContent}>
      {Array.from({ length: SKELETON_CARDS }, (_, i) => (
        <View key={i} style={styles.card}>
          <View style={[styles.cardCover, styles.cardCoverFallback]} />
          <View style={styles.cardBody}>
            <View style={[styles.cardAvatar, styles.skeletonAvatar]} />
            <View style={styles.cardInfo}>
              <View style={[styles.skeletonBar, { width: "55%" }]} />
              <View style={[styles.skeletonBar, styles.skeletonBarThin]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function CreateRoomHeaderButton() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Start a room"
      onPress={() => router.push("/communities/create")}
      hitSlop={8}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
    >
      <Ionicons name="add" size={26} color={colors.foreground} />
    </Pressable>
  );
}

const screenOptions = {
  title: "Rooms",
  headerRight: () => <CreateRoomHeaderButton />,
};

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
      <View style={styles.flex}>
        <Stack.Screen options={screenOptions} />
        <RoomsSkeleton />
      </View>
    );
  }

  if (allQuery.isError) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
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
      <Stack.Screen options={screenOptions} />
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
                  joined
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
          <CommunityCard
            community={item}
            joined={false}
            onPress={() => openRoom(item)}
          />
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
    fontWeight: "600",
    letterSpacing: -0.2,
    marginBottom: spacing(2.5),
    marginTop: spacing(1),
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: spacing(3),
  },
  cardCover: {
    width: "100%",
    aspectRatio: 16 / 6,
  },
  cardCoverFallback: {
    backgroundColor: colors.surfaceElevated,
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing(3),
    paddingBottom: spacing(3),
  },
  cardAvatar: {
    marginTop: -spacing(4),
    borderRadius: radii.full,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  cardInfo: {
    flex: 1,
    marginLeft: spacing(2.5),
    marginTop: spacing(2),
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
  },
  cardName: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  privateLabel: {
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: "600",
  },
  cardMembers: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 1,
  },
  stateChip: {
    marginTop: spacing(2),
    minHeight: 30,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing(3.5),
  },
  stateChipJoined: {
    backgroundColor: colors.surfaceElevated,
  },
  stateChipLabel: {
    color: colors.primaryForeground,
    fontSize: 12.5,
    fontWeight: "600",
  },
  stateChipLabelJoined: {
    color: colors.foreground,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonBarThin: {
    width: "35%",
    height: 10,
    marginTop: 7,
  },
});
