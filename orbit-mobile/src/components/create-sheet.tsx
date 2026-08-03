import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { colors, radii, spacing } from "@/lib/theme";

const BACKDROP = "rgba(0, 0, 0, 0.55)";
const FADE_MS = 160;
const SLIDE_MS = 200;
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 4;

export type CreateMode = "post" | "clip" | "story" | "live";

/**
 * Bottom sheet behind the center tab-bar Create button. Same backdrop-fade
 * plus RAF-kicked slide as ClipCommentsSheet; see that component for why the
 * two layers animate independently. `defaultMode` pre-highlights a row so
 * entry points can steer toward one format without forcing it.
 */
export function CreateSheet({
  visible,
  onClose,
  defaultMode,
}: {
  visible: boolean;
  onClose: () => void;
  defaultMode?: CreateMode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [fade] = useState(() => new Animated.Value(0));
  const [slide] = useState(() => new Animated.Value(height));

  useEffect(() => {
    if (!visible) {
      fade.setValue(0);
      slide.setValue(height);
      return;
    }
    slide.setValue(height);
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

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  const rowIconColor = (mode: CreateMode) =>
    defaultMode === mode ? colors.primary : colors.textSecondary;

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
          accessibilityLabel="Close create"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            paddingBottom: insets.bottom + spacing(3),
            transform: [{ translateY: slide }],
          },
        ]}
      >
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        <Text style={styles.title}>Create</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a post"
          onPress={() => go("/compose")}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="create-outline" size={22} color={rowIconColor("post")} />
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>Post</Text>
            <Text style={styles.rowHint}>Share text, photos, or a poll</Text>
          </View>
        </Pressable>

        <View style={styles.row}>
          <Ionicons name="film-outline" size={22} color={rowIconColor("clip")} />
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>Clip</Text>
            <Text style={styles.rowHint}>Short looping video</Text>
          </View>
          <View style={styles.clipActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Record a clip"
              onPress={() => go("/clip-camera")}
              style={({ pressed }) => [styles.clipButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="videocam-outline" size={15} color={colors.foreground} />
              <Text style={styles.clipButtonLabel}>Record</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Upload a clip"
              onPress={() => go("/clip-upload")}
              style={({ pressed }) => [styles.clipButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="cloud-upload-outline" size={15} color={colors.foreground} />
              <Text style={styles.clipButtonLabel}>Upload</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a story"
          onPress={() => go("/create-story")}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="camera-outline" size={22} color={rowIconColor("story")} />
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>Story</Text>
            <Text style={styles.rowHint}>Disappears after 24 hours</Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go live"
          // The Go live flow is a sheet owned by the live surface, so this
          // lands on /live where that sheet opens.
          onPress={() => go("/live")}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="radio-outline" size={22} color={rowIconColor("live")} />
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>Go live</Text>
            <Text style={styles.rowHint}>Broadcast to your followers</Text>
          </View>
        </Pressable>
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
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: HANDLE_HEIGHT / 2,
    backgroundColor: colors.border,
  },
  title: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
    paddingBottom: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowBody: {
    flex: 1,
  },
  rowLabel: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  rowHint: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 1,
  },
  clipActions: {
    flexDirection: "row",
    gap: spacing(2),
  },
  clipButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  clipButtonLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
  },
});
