import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui";
import { getActiveStories, type StoryGroup } from "@/lib/queries/stories";
import { getOwnProfile } from "@/lib/queries/profiles";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const AVATAR_SIZE = 64;
const RING_WIDTH = 2.5;
const SATELLITE_SIZE = 14;
const SATELLITE_ADD_SIZE = 20;

/**
 * Orbit's own ring motif, drawn like the OrbitMark in auth-shell: a circular
 * ring with a small filled satellite dot sitting on its edge at roughly the
 * 1-2 o'clock position. Unviewed rings are violet with the satellite; viewed
 * rings drop to the border color and lose the dot; the add-story variant puts
 * a plus glyph inside the satellite.
 */
function OrbitRing({
  variant,
  children,
}: {
  variant: "unviewed" | "viewed" | "add";
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.ring,
        { borderColor: variant === "unviewed" ? colors.primary : colors.border },
      ]}
    >
      {children}
      {variant === "unviewed" ? <View style={styles.satellite} /> : null}
      {variant === "add" ? (
        <View style={[styles.satellite, styles.satelliteAdd]}>
          <Ionicons name="add" size={14} color={colors.primaryForeground} />
        </View>
      ) : null}
    </View>
  );
}

function StoryRing({ group, isSelf }: { group: StoryGroup; isSelf: boolean }) {
  const router = useRouter();
  const name = isSelf ? "Your story" : group.user.display_name || group.user.username;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View stories from ${name}`}
      onPress={() => router.push(`/story/${group.user.id}`)}
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.8 }]}
    >
      <OrbitRing variant={group.hasUnviewed ? "unviewed" : "viewed"}>
        <Avatar
          url={group.user.avatar_url}
          name={group.user.display_name || group.user.username}
          size={AVATAR_SIZE}
        />
      </OrbitRing>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

/**
 * The viewer's own tile when they have no active story: their avatar inside
 * the ring with a plus inside the satellite dot, tapping anywhere on it
 * opens the story creator.
 */
function AddStoryRing({
  avatarUrl,
  name,
}: {
  avatarUrl: string | null | undefined;
  name: string;
}) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Create a story"
      onPress={() => router.push("/create-story")}
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.8 }]}
    >
      <OrbitRing variant="add">
        <Avatar url={avatarUrl} name={name} size={AVATAR_SIZE} />
      </OrbitRing>
      <Text style={styles.name} numberOfLines={1}>
        Your story
      </Text>
    </Pressable>
  );
}

/**
 * IG-style horizontal strip of active story rings, one per author, the
 * viewer's own tile always first: their live ring when they have an active
 * story, otherwise an add tile that opens the story creator. Renders
 * nothing while loading so the feed above it does not jump.
 */
export function StoriesBar() {
  const { user } = useAuth();

  const { data: groups } = useQuery({
    queryKey: ["stories", user?.id],
    queryFn: () => getActiveStories(user!.id),
    enabled: !!user,
  });

  // Own avatar for the add tile; shares the profile cache key used by the
  // profile and compose screens.
  const { data: ownProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getOwnProfile(user!.id),
    enabled: !!user,
  });

  if (!user || !groups) return null;

  const ownGroup = groups.find((group) => group.user.id === user.id);
  const otherGroups = groups.filter((group) => group.user.id !== user.id);

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={otherGroups}
        keyExtractor={(group) => group.user.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          ownGroup ? (
            <StoryRing group={ownGroup} isSelf />
          ) : (
            <AddStoryRing
              avatarUrl={ownProfile?.avatar_url}
              name={ownProfile?.display_name || ownProfile?.username || "You"}
            />
          )
        }
        renderItem={({ item }) => <StoryRing group={item} isSelf={false} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  content: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    gap: spacing(3.5),
  },
  item: {
    alignItems: "center",
    width: AVATAR_SIZE + spacing(3),
  },
  ring: {
    borderWidth: RING_WIDTH,
    borderRadius: radii.full,
    padding: 2.5,
  },
  // Sits on the ring's edge at roughly 1-2 o'clock, matching the OrbitMark.
  satellite: {
    position: "absolute",
    top: 0,
    right: 0,
    width: SATELLITE_SIZE,
    height: SATELLITE_SIZE,
    borderRadius: SATELLITE_SIZE / 2,
    backgroundColor: colors.primary,
  },
  satelliteAdd: {
    top: -3,
    right: -3,
    width: SATELLITE_ADD_SIZE,
    height: SATELLITE_ADD_SIZE,
    borderRadius: SATELLITE_ADD_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: colors.mutedForeground,
    fontSize: 11,
    marginTop: spacing(1.5),
    maxWidth: AVATAR_SIZE + spacing(3),
  },
});
