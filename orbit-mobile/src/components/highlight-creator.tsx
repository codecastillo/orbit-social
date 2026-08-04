import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Field } from "@/components/ui";
import { createHighlight, getOwnStories } from "@/lib/queries/highlights";
import { useVideoFrame } from "@/lib/video-frame";
import type { StoryWithAuthor } from "@/lib/queries/stories";
import { colors, radii, spacing } from "@/lib/theme";

const BACKDROP = "rgba(0, 0, 0, 0.55)";
// Sits on top of the thumbnail, so the pill needs its own dark plate.
const TILE_SCRIM = "rgba(0, 0, 0, 0.65)";
const MAX_TITLE_LENGTH = 40;
const MAX_STORIES_PER_HIGHLIGHT = 20;
const GRID_GAP = spacing(1.5);
const GRID_COLUMNS = 3;

function StoryTile({
  story,
  size,
  order,
  expired,
  onToggle,
}: {
  story: StoryWithAuthor;
  size: number;
  order: number;
  expired: boolean;
  onToggle: () => void;
}) {
  const selected = order >= 0;
  const needsFrame = story.media_type === "video" && !story.thumbnail_url;
  const frame = useVideoFrame(needsFrame ? story.media_url : null);
  const source = needsFrame ? frame : (story.thumbnail_url ?? story.media_url);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={selected ? "Remove moment" : "Add moment"}
      accessibilityState={{ selected }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.tile,
        { width: size, height: size * (16 / 9) },
        selected && styles.tileSelected,
        pressed && { opacity: 0.8 },
      ]}
    >
      {source ? (
        <Image
          source={{ uri: source }}
          alt="Moment"
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.tilePlaceholder]} />
      )}
      {selected ? (
        <View style={styles.orderBadge}>
          <Text style={styles.orderBadgeText}>{order + 1}</Text>
        </View>
      ) : null}
      {expired ? (
        <View style={styles.expiredBadge}>
          <Text style={styles.expiredBadgeText}>Expired</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Owner-only sheet that assembles a highlight from any of the author's
 * moments, active or archived, since the stories SELECT policy carves out
 * the author. The first picked moment becomes the cover.
 */
export function HighlightCreator({
  visible,
  onClose,
  userId,
}: {
  visible: boolean;
  onClose: () => void;
  userId: string;
}) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [title, setTitle] = useState("");
  // Insertion order matters: it becomes the playback order and picks the cover.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const tileSize =
    (width - spacing(4) * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const storiesQuery = useQuery({
    queryKey: ["own-stories", userId],
    queryFn: () => getOwnStories(userId),
    enabled: visible,
  });

  const toggle = (storyId: string) => {
    setSelectedIds((prev) =>
      prev.includes(storyId)
        ? prev.filter((id) => id !== storyId)
        : prev.length < MAX_STORIES_PER_HIGHLIGHT
          ? [...prev, storyId]
          : prev,
    );
  };

  const reset = () => {
    setTitle("");
    setSelectedIds([]);
  };

  const create = useMutation({
    mutationFn: () => createHighlight(title.trim(), selectedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["story-highlights", userId] });
      reset();
      onClose();
    },
    onError: () => Alert.alert("Couldn't create highlight"),
  });

  const close = () => {
    reset();
    onClose();
  };

  const stories = storiesQuery.data ?? [];
  const canCreate =
    !!title.trim() && selectedIds.length > 0 && !create.isPending;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.backdrop}
          onPress={close}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing(4) }]}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.heading}>New highlight</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={close}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <Text style={styles.subheading}>
            Pick moments to keep on your profile. The first one becomes the
            cover.
          </Text>

          <Field
            label="Name"
            value={title}
            onChangeText={setTitle}
            maxLength={MAX_TITLE_LENGTH}
            placeholder="Highlight name"
          />

          {storiesQuery.isPending ? (
            <View style={styles.state}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : stories.length === 0 ? (
            <Text style={styles.emptyText}>
              No moments yet. Post a moment first.
            </Text>
          ) : (
            <FlatList
              data={stories}
              numColumns={GRID_COLUMNS}
              keyExtractor={(s) => s.id}
              columnWrapperStyle={styles.gridRow}
              style={styles.grid}
              renderItem={({ item }) => (
                <StoryTile
                  story={item}
                  size={tileSize}
                  order={selectedIds.indexOf(item.id)}
                  expired={
                    new Date(item.expires_at).getTime() <= storiesQuery.dataUpdatedAt
                  }
                  onToggle={() => toggle(item.id)}
                />
              )}
            />
          )}

          <Button
            label="Create"
            loading={create.isPending}
            disabled={!canCreate}
            onPress={() => create.mutate()}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BACKDROP,
  },
  sheet: {
    maxHeight: "85%",
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing(2),
    paddingHorizontal: spacing(4),
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    marginBottom: spacing(3),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "700",
  },
  subheading: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing(1),
    marginBottom: spacing(3.5),
  },
  state: {
    padding: spacing(6),
    alignItems: "center",
  },
  emptyText: {
    color: colors.mutedForeground,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: "center",
    paddingVertical: spacing(5),
  },
  grid: {
    // Bounded so the sheet's Create button stays on screen; the grid
    // scrolls internally past two rows.
    flexGrow: 0,
    maxHeight: 340,
    marginBottom: spacing(4),
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  tile: {
    borderRadius: radii.sm,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  tileSelected: {
    borderColor: colors.primary,
  },
  tilePlaceholder: {
    backgroundColor: colors.surface,
  },
  orderBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  orderBadgeText: {
    color: colors.primaryForeground,
    fontSize: 11,
    fontWeight: "700",
  },
  expiredBadge: {
    position: "absolute",
    left: 4,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: TILE_SCRIM,
  },
  expiredBadgeText: {
    color: colors.mutedForeground,
    fontSize: 9.5,
    fontWeight: "600",
  },
});
