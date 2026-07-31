import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui";
import { getActiveStories, type StoryGroup } from "@/lib/queries/stories";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const AVATAR_SIZE = 56;

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
      <View
        style={[
          styles.ring,
          { borderColor: group.hasUnviewed ? colors.primary : colors.border },
        ]}
      >
        <Avatar
          url={group.user.avatar_url}
          name={group.user.display_name || group.user.username}
          size={AVATAR_SIZE}
        />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

/**
 * Horizontal row of active story rings, one per author, unviewed authors
 * highlighted. Renders nothing while loading or when nobody has an active
 * story so the feed above it does not jump around an empty strip.
 */
export function StoriesBar() {
  const { user } = useAuth();

  const { data: groups } = useQuery({
    queryKey: ["stories", user?.id],
    queryFn: () => getActiveStories(user!.id),
    enabled: !!user,
  });

  if (!user || !groups || groups.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={groups}
        keyExtractor={(group) => group.user.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <StoryRing group={item} isSelf={item.user.id === user.id} />
        )}
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
    paddingVertical: spacing(3),
    gap: spacing(3.5),
  },
  item: {
    alignItems: "center",
    width: AVATAR_SIZE + spacing(4),
  },
  ring: {
    borderWidth: 2,
    borderRadius: radii.full,
    padding: 2,
  },
  name: {
    color: colors.textSecondary,
    fontSize: 11.5,
    marginTop: spacing(1.5),
    maxWidth: AVATAR_SIZE + spacing(4),
  },
});
