import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Stack, useRouter, type Href } from "expo-router";
import { Image } from "expo-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Centered, EmptyState } from "@/components/ui";
import { HighlightCreator } from "@/components/highlight-creator";
import {
  addStoriesToHighlight,
  getHighlights,
} from "@/lib/queries/highlights";
import {
  deleteStory,
  getArchivedStories,
  type StoryWithAuthor,
} from "@/lib/queries/stories";
import { useVideoFrame } from "@/lib/video-frame";
import { formatTimeAgo } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const GRID_GAP = spacing(1);
const GRID_COLUMNS = 3;
// The caption plate sits on the thumbnail, so it carries its own scrim.
const TILE_SCRIM = "rgba(0, 0, 0, 0.55)";

function ArchiveTile({
  story,
  size,
  onPress,
  onLongPress,
}: {
  story: StoryWithAuthor;
  size: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const needsFrame = story.media_type === "video" && !story.thumbnail_url;
  const frame = useVideoFrame(needsFrame ? story.media_url : null);
  const source = needsFrame ? frame : (story.thumbnail_url ?? story.media_url);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Moment from ${formatTimeAgo(story.created_at)}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.tile,
        { width: size, height: size * (16 / 9) },
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
      <View style={styles.tileCaption}>
        <Text style={styles.tileCaptionText}>
          {formatTimeAgo(story.created_at)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function MomentsArchiveScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [creatorOpen, setCreatorOpen] = useState(false);

  const archiveKey = ["archived-stories", user?.id];

  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: archiveKey,
    queryFn: () => getArchivedStories(user!.id),
    enabled: !!user,
  });

  // Prefetched by the query cache when the profile highlights strip has
  // already loaded, so the action sheet opens without a spinner.
  const { data: highlights } = useQuery({
    queryKey: ["story-highlights", user?.id],
    queryFn: () => getHighlights(user!.id),
    enabled: !!user,
  });

  const tileSize =
    (width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const addToHighlight = (highlightId: string, storyId: string) => {
    addStoriesToHighlight(highlightId, [storyId])
      .then(() => {
        queryClient.invalidateQueries({
          queryKey: ["story-highlights", user?.id],
        });
      })
      .catch(() => Alert.alert("Couldn't add to that collection"));
  };

  const confirmDelete = (story: StoryWithAuthor) => {
    Alert.alert("Delete this moment?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteStory(story.id)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: archiveKey });
              queryClient.invalidateQueries({ queryKey: ["own-stories", user?.id] });
            })
            .catch(() => Alert.alert("Couldn't delete the moment"));
        },
      },
    ]);
  };

  const openCollectionPicker = (story: StoryWithAuthor) => {
    Alert.alert("Add to collection", undefined, [
      ...(highlights ?? []).map((highlight) => ({
        text: highlight.title,
        onPress: () => addToHighlight(highlight.id, story.id),
      })),
      { text: "New collection", onPress: () => setCreatorOpen(true) },
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  const openActions = (story: StoryWithAuthor) => {
    Alert.alert("Moment options", undefined, [
      { text: "Add to collection", onPress: () => openCollectionPicker(story) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => confirmDelete(story),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  if (!user) return null;

  if (isPending) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Moments archive" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Moments archive" }} />
        <EmptyState
          title="Your archive did not load"
          description="Check your connection and try again."
          action={
            <Button label="Retry" variant="outline" onPress={() => refetch()} />
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: "Moments archive" }} />
      <FlatList
        data={data}
        numColumns={GRID_COLUMNS}
        keyExtractor={(story) => story.id}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item, index }) => (
          <ArchiveTile
            story={item}
            size={tileSize}
            onPress={() =>
              router.push(
                `/story/${user.id}?archive=1&index=${index}` as Href,
              )
            }
            onLongPress={() => openActions(item)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.mutedForeground}
          />
        }
        ListHeaderComponent={
          data && data.length > 0 ? (
            <View style={styles.header}>
              <View style={styles.satellite} />
              <Text style={styles.headerText}>
                Your expired moments. Only you can see this.
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            title="No archived moments yet"
            description="Moments land here 24 hours after you post them, and stay visible to you alone."
          />
        }
        contentContainerStyle={data?.length === 0 ? styles.flex : undefined}
      />

      <HighlightCreator
        visible={creatorOpen}
        onClose={() => setCreatorOpen(false)}
        userId={user.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  // The brand mark's orbiting dot, same lead-in the story chrome uses.
  satellite: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  headerText: {
    flex: 1,
    color: colors.mutedForeground,
    fontSize: 12.5,
    lineHeight: 17,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  tile: {
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  tilePlaceholder: {
    backgroundColor: colors.surfaceElevated,
  },
  tileCaption: {
    position: "absolute",
    left: 4,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: TILE_SCRIM,
  },
  tileCaptionText: {
    color: colors.foreground,
    fontSize: 10,
    fontWeight: "600",
  },
});
