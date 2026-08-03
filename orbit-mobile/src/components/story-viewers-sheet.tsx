import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui";
import { getStoryViewers, type StoryViewerRecord } from "@/lib/queries/stories";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

const BACKDROP = "rgba(0, 0, 0, 0.55)";
const FADE_MS = 160;
const SLIDE_MS = 200;
const SHEET_RATIO = 0.55;

function ViewerRow({ viewer }: { viewer: StoryViewerRecord }) {
  const name = viewer.profiles.display_name || viewer.profiles.username;
  return (
    <View style={styles.viewerRow}>
      <Avatar url={viewer.profiles.avatar_url} name={name} size={40} />
      <View style={styles.viewerBody}>
        <Text style={styles.viewerName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.viewerUsername} numberOfLines={1}>
          @{viewer.profiles.username}
        </Text>
      </View>
      <Text style={styles.viewerTime}>{formatTimeAgo(viewer.viewed_at)}</Text>
    </View>
  );
}

/**
 * Own-story viewer list, opened from the eye chip in the story viewer. Same
 * fade-backdrop plus slide-panel construction as ClipCommentsSheet: the story
 * keeps playing dimmed underneath instead of the whole background sliding.
 */
export function StoryViewersSheet({
  visible,
  onClose,
  storyId,
}: {
  visible: boolean;
  onClose: () => void;
  storyId: string;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [fade] = useState(() => new Animated.Value(0));
  const [slide] = useState(() => new Animated.Value(height));

  useEffect(() => {
    if (!visible) {
      // Reset both so the next open starts fully off-screen instead of
      // flashing one frame at the previous resting position.
      fade.setValue(0);
      slide.setValue(height);
      return;
    }
    slide.setValue(height);
    // Kick the animation one frame after the content mounts, same reasoning
    // as ClipCommentsSheet: mount-frame layout competes with the slide.
    const raf = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: FADE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 0,
          duration: SLIDE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(raf);
  }, [visible, height, fade, slide]);

  const viewersQuery = useQuery({
    queryKey: ["story-viewers", storyId],
    queryFn: () => getStoryViewers(storyId),
    enabled: visible,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable
          style={styles.flex}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close viewers"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            height: height * SHEET_RATIO,
            paddingBottom: insets.bottom + spacing(2),
            transform: [{ translateY: slide }],
          },
        ]}
      >
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Viewers
            {viewersQuery.data && viewersQuery.data.length > 0 ? (
              <Text style={styles.headerCount}>
                {"  "}
                {formatNumber(viewersQuery.data.length)}
              </Text>
            ) : null}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close viewers"
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {viewersQuery.isPending ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : viewersQuery.isError ? (
          <View style={styles.stateWrap}>
            <Text style={styles.stateText}>Viewers did not load.</Text>
          </View>
        ) : (
          <FlatList
            data={viewersQuery.data}
            keyExtractor={(viewer) => viewer.viewer_id}
            renderItem={({ item }) => <ViewerRow viewer={item} />}
            ListEmptyComponent={
              <View style={styles.stateWrap}>
                <Text style={styles.emptyTitle}>No views yet</Text>
                <Text style={styles.stateText}>
                  People who watch this story will show up here.
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
            style={styles.flex}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BACKDROP,
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  handleWrap: {
    alignItems: "center",
    paddingBottom: spacing(2),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  headerCount: {
    color: colors.mutedForeground,
    fontWeight: "400",
    fontSize: 13,
  },
  listContent: {
    flexGrow: 1,
    paddingVertical: spacing(2),
  },
  viewerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    paddingVertical: spacing(2.5),
  },
  viewerBody: {
    flex: 1,
    minWidth: 0,
  },
  viewerName: {
    color: colors.foreground,
    fontSize: 13.5,
    fontWeight: "600",
  },
  viewerUsername: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 1,
  },
  viewerTime: {
    color: colors.textFaint,
    fontSize: 11.5,
  },
  stateWrap: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2.5),
    padding: spacing(6),
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  stateText: {
    color: colors.mutedForeground,
    fontSize: 13,
    textAlign: "center",
  },
});
