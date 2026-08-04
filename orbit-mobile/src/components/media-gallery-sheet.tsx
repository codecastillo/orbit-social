import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { MediaViewerModal, type ViewerMedia } from "@/components/message-media";
import {
  MESSAGE_PAGE_SIZE,
  getMediaMessages,
  voiceMessageUrl,
} from "@/lib/queries/messages";
import { colors, radii, spacing } from "@/lib/theme";

const GRID_COLUMNS = 3;
const GRID_GAP = 2;

/**
 * Full-screen sheet with a grid of this conversation's media messages,
 * paged 30 at a time. Voice clips share the media column but not the
 * gallery. Tapping a tile opens the shared full-screen viewer.
 */
export function MediaGallerySheet({
  visible,
  conversationId,
  onClose,
}: {
  visible: boolean;
  conversationId: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [viewer, setViewer] = useState<ViewerMedia | null>(null);

  const {
    data,
    isPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["message-media", conversationId],
    queryFn: ({ pageParam }) => getMediaMessages(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length < MESSAGE_PAGE_SIZE
        ? undefined
        : lastPage[lastPage.length - 1]?.created_at,
    enabled: visible && !!conversationId,
  });

  const items = (data?.pages.flat() ?? []).filter(
    (m) => m.media_url && !voiceMessageUrl(m),
  );
  const tileSize = (width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close media gallery"
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-back" size={26} color={colors.foreground} />
          </Pressable>
          <Text style={styles.headerTitle}>Media</Text>
        </View>

        {isPending ? (
          <ActivityIndicator
            color={colors.mutedForeground}
            style={styles.loading}
          />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No media yet</Text>
            <Text style={styles.emptyText}>
              Photos and videos shared here will show up in this gallery.
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            numColumns={GRID_COLUMNS}
            keyExtractor={(m) => m.id}
            columnWrapperStyle={{ gap: GRID_GAP }}
            contentContainerStyle={{ gap: GRID_GAP }}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isFetchingNextPage ? (
                <ActivityIndicator
                  color={colors.mutedForeground}
                  style={{ paddingVertical: spacing(3) }}
                />
              ) : null
            }
            renderItem={({ item }) => {
              const isVideo = item.media_type === "video";
              return (
                <Pressable
                  accessibilityRole="imagebutton"
                  accessibilityLabel={isVideo ? "View video" : "View image"}
                  onPress={() =>
                    setViewer({
                      url: item.media_url!,
                      type: isVideo ? "video" : "image",
                    })
                  }
                  style={({ pressed }) => [
                    styles.tile,
                    { width: tileSize, height: tileSize },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  {isVideo ? (
                    // No thumbnail pipeline for videos; a play tile keeps the
                    // grid cheap instead of mounting a player per cell.
                    <View style={styles.videoTile}>
                      <Ionicons
                        name="play-circle"
                        size={30}
                        color={colors.textSecondary}
                      />
                    </View>
                  ) : (
                    <Image
                      source={{ uri: item.media_url! }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={100}
                      alt=""
                      cachePolicy="memory-disk"
                      recyclingKey={item.media_url}
                    />
                  )}
                </Pressable>
              );
            }}
          />
        )}
      </View>

      <MediaViewerModal media={viewer} onClose={() => setViewer(null)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  loading: {
    marginTop: spacing(8),
  },
  tile: {
    backgroundColor: colors.surface,
  },
  videoTile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: spacing(8),
    marginTop: spacing(16),
    gap: spacing(1.5),
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  emptyText: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
