import { useEffect, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui";
import { getActiveStories, type StoryGroup } from "@/lib/queries/stories";
import { getOwnProfile } from "@/lib/queries/profiles";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const CARD_WIDTH = 72;
const CARD_HEIGHT = 96;
const CHIP_SIZE = 24;
const DOT_SIZE = 10;
const SEEN_OPACITY = 0.6;

/**
 * Rounded-rectangle moment preview card, Orbit's replacement for the
 * gradient-ringed avatar circle: the first unseen moment's media as the
 * card face (video thumbnails, or a play glyph when a video has none), the
 * author's avatar chip overlapping the top-left, the name on a bottom
 * scrim, and a violet corner satellite-dot while unseen. Seen cards dim
 * and lose the dot; close-friends groups tint the dot and border emerald.
 */
function StoryCard({ group, isSelf }: { group: StoryGroup; isSelf: boolean }) {
  const router = useRouter();
  const name = isSelf ? "You" : group.user.display_name || group.user.username;
  // Only when everything visible from this author is close friends; a mixed
  // set keeps the violet dot so public stories are not mislabeled.
  const closeFriends =
    !isSelf && group.stories.every((s) => s.visibility === "close_friends");
  const accent = closeFriends ? colors.success : colors.primary;
  const unseen = group.hasUnviewed;

  const face = group.stories.find((s) => !s.viewed) ?? group.stories[0];
  const faceUri =
    face.media_type === "image" ? face.media_url : face.thumbnail_url;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View moments from ${name}`}
      onPress={() => router.push(`/story/${group.user.id}`)}
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.8 }]}
    >
      <View
        style={[
          styles.card,
          closeFriends && { borderColor: colors.success },
          !unseen && { opacity: SEEN_OPACITY },
        ]}
      >
        {faceUri ? (
          <Image
            source={{ uri: faceUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={100}
            alt=""
            cachePolicy="memory-disk"
            recyclingKey={faceUri}
          />
        ) : (
          <View style={styles.playFace}>
            <Ionicons name="play" size={20} color="rgba(255, 255, 255, 0.7)" />
          </View>
        )}
        <View style={styles.scrim}>
          <Text style={styles.cardName} numberOfLines={1}>
            {name}
          </Text>
        </View>
      </View>
      <View style={styles.chip}>
        <Avatar
          url={group.user.avatar_url}
          name={group.user.display_name || group.user.username}
          size={CHIP_SIZE}
        />
      </View>
      {unseen ? (
        <View style={[styles.satellite, { backgroundColor: accent }]} />
      ) : null}
    </Pressable>
  );
}

/**
 * The viewer's own tile when they have no active moment: a dashed card
 * face with a plus glyph and their avatar chip, tapping anywhere on it
 * opens the camera-first moment flow. With `nudge` (no moment posted
 * today) the label turns into a violet "Today's moment" prompt and a
 * pulsing satellite dot appears; a gentle daily reminder, never a lock.
 */
function AddStoryCard({
  avatarUrl,
  name,
  nudge,
}: {
  avatarUrl: string | null | undefined;
  name: string;
  nudge: boolean;
}) {
  const router = useRouter();
  // Lazy useState instead of useRef so reading the value in render does
  // not trip the react-hooks/refs rule.
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!nudge) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [nudge, pulse]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        nudge ? "Capture today's moment" : "Create a moment"
      }
      onPress={() => router.push("/moment-camera")}
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.card, styles.addCard]}>
        <View style={styles.addBadge}>
          <Ionicons name="add" size={16} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.addLabel, nudge && styles.nudgeLabel]} numberOfLines={2}>
          {nudge ? "Today's moment" : "Add"}
        </Text>
      </View>
      <View style={styles.chip}>
        <Avatar url={avatarUrl} name={name} size={CHIP_SIZE} />
      </View>
      {nudge ? (
        <Animated.View
          style={[
            styles.satellite,
            { backgroundColor: colors.primary, opacity: pulse },
          ]}
        />
      ) : null}
    </Pressable>
  );
}

/**
 * Horizontal strip of moment preview cards, one per author, the viewer's
 * own tile always first: their live card when they have an active moment,
 * otherwise an add tile that opens the moment creator. Renders nothing
 * while loading so the feed above it does not jump.
 */
export function StoriesBar() {
  const { user } = useAuth();

  const { data: groups } = useQuery({
    queryKey: ["stories", user?.id],
    queryFn: () => getActiveStories(user!.id),
    enabled: !!user,
    // Moments live for a day; the ring strip does not need minute freshness.
    staleTime: 1000 * 60 * 2,
  });

  // Own avatar for the add tile; shares the profile cache key used by the
  // profile and compose screens.
  const { data: ownProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getOwnProfile(user!.id),
    enabled: !!user,
    // Same freshness the profile tab asks for, so the shared key does not
    // refetch on whichever screen happens to mount second.
    staleTime: 1000 * 60 * 5,
  });

  if (!user || !groups) return null;

  const ownGroup = groups.find((group) => group.user.id === user.id);
  const otherGroups = groups.filter((group) => group.user.id !== user.id);

  // Daily prompt: no own active story created since local midnight. Stories
  // live 24h, so anything posted today would still be active and visible
  // here; deletions are the only way this differs from "add card shown".
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const postedToday =
    ownGroup?.stories.some((s) => new Date(s.created_at) >= todayStart) ??
    false;

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
            <StoryCard group={ownGroup} isSelf />
          ) : (
            <AddStoryCard
              avatarUrl={ownProfile?.avatar_url}
              name={ownProfile?.display_name || ownProfile?.username || "You"}
              nudge={!postedToday}
            />
          )
        }
        renderItem={({ item }) => <StoryCard group={item} isSelf={false} />}
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
    gap: spacing(2.5),
  },
  item: {
    width: CARD_WIDTH,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
  },
  playFace: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
  },
  cardName: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  // Overlaps the card's top-left corner; the background-colored ring keeps
  // it legible over any media.
  chip: {
    position: "absolute",
    top: -spacing(1),
    left: -spacing(1),
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.background,
  },
  // The corner satellite-dot carries the unseen signal the ring used to.
  satellite: {
    position: "absolute",
    top: -3,
    right: -3,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.background,
  },
  addCard: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(1),
  },
  addBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addLabel: {
    color: colors.mutedForeground,
    fontSize: 10,
    fontWeight: "600",
  },
  nudgeLabel: {
    color: colors.primary,
    textAlign: "center",
    paddingHorizontal: spacing(1),
  },
});
