import { useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteHighlight,
  getHighlights,
  type HighlightWithStories,
} from "@/lib/queries/highlights";
import { HighlightCreator } from "@/components/highlight-creator";
import { colors, radii, spacing } from "@/lib/theme";

const COVER_SIZE = 56;
const RING_WIDTH = 2;
const SATELLITE_SIZE = 10;

/**
 * Same satellite-dot ring motif as the stories bar, shrunk for the profile
 * highlights strip: a violet circle with the small filled dot at roughly
 * the 1-2 o'clock position.
 */
function HighlightRing({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.ring}>
      {children}
      <View style={styles.satellite} />
    </View>
  );
}

/**
 * Horizontal strip of story highlights under the profile header. Visitors
 * see nothing when the profile has none; the owner always gets the New tile.
 * Long-press lets the owner delete a highlight (the stories stay).
 */
export function HighlightsRow({
  userId,
  isOwner,
}: {
  userId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [creatorOpen, setCreatorOpen] = useState(false);

  const { data: highlights } = useQuery({
    queryKey: ["story-highlights", userId],
    queryFn: () => getHighlights(userId),
  });

  if (!highlights || (highlights.length === 0 && !isOwner)) return null;

  const confirmDelete = (highlight: HighlightWithStories) => {
    if (!isOwner) return;
    Alert.alert("Delete this highlight?", "The moments in it are not deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteHighlight(highlight.id);
            queryClient.invalidateQueries({
              queryKey: ["story-highlights", userId],
            });
          } catch {
            Alert.alert("Couldn't delete highlight");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={highlights}
        keyExtractor={(h) => h.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          isOwner ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a highlight"
              onPress={() => setCreatorOpen(true)}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.8 }]}
            >
              <View style={[styles.ring, styles.addRing]}>
                <Ionicons name="add" size={22} color={colors.mutedForeground} />
              </View>
              <Text style={styles.title} numberOfLines={1}>
                New
              </Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Play highlight ${item.title}`}
            onPress={() =>
              router.push(`/story/${userId}?highlight=${item.id}`)
            }
            onLongPress={() => confirmDelete(item)}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.8 }]}
          >
            <HighlightRing>
              {item.cover_url ? (
                <Image
                  source={{ uri: item.cover_url }}
                  alt={item.title}
                  style={styles.cover}
                  contentFit="cover"
                  transition={0}
                />
              ) : (
                <View style={[styles.cover, styles.coverFallback]} />
              )}
            </HighlightRing>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
          </Pressable>
        )}
      />

      {isOwner ? (
        <HighlightCreator
          visible={creatorOpen}
          onClose={() => setCreatorOpen(false)}
          userId={userId}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  content: {
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(3),
    gap: spacing(3.5),
  },
  item: {
    alignItems: "center",
    width: COVER_SIZE + spacing(3),
  },
  ring: {
    width: COVER_SIZE + (RING_WIDTH + 2.5) * 2,
    height: COVER_SIZE + (RING_WIDTH + 2.5) * 2,
    borderWidth: RING_WIDTH,
    borderColor: colors.primary,
    borderRadius: radii.full,
    padding: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  addRing: {
    borderColor: colors.border,
    borderStyle: "dashed",
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
  cover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: COVER_SIZE / 2,
  },
  coverFallback: {
    backgroundColor: colors.surfaceElevated,
  },
  title: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: spacing(1.5),
    maxWidth: COVER_SIZE + spacing(3),
  },
});
