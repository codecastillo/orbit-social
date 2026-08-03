import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type {
  StoryOverlayPosition,
  StorySelfie,
  StorySticker,
  StoryTextOverlay,
} from "@/lib/queries/stories";
import { colors, radii, spacing } from "@/lib/theme";

// Overlay chrome sits on the always-dark media canvas, so it uses literal
// white like the story viewer's chrome instead of theme tokens.
const OVERLAY_TEXT = "#ffffff";
const CHIP_BACKGROUND = "rgba(0, 0, 0, 0.6)";

// Selfie picture-in-picture geometry, shared by the capture preview and the
// viewer so the composite looks identical everywhere. Corner insets are
// percentages so the PiP clears the viewer's progress chrome on top and the
// reaction bar on the bottom.
const SELFIE_WIDTH_PCT = "32%";
const SELFIE_ASPECT = 3 / 4;
const SELFIE_EDGE_PCT = "9%";

const POSITIONS: StoryOverlayPosition[] = ["top", "center", "bottom"];

const selfieCornerStyles: Record<StorySelfie["position"], object> = {
  "top-left": { top: SELFIE_EDGE_PCT, left: spacing(3) },
  "top-right": { top: SELFIE_EDGE_PCT, right: spacing(3) },
  "bottom-left": { bottom: SELFIE_EDGE_PCT, left: spacing(3) },
  "bottom-right": { bottom: SELFIE_EDGE_PCT, right: spacing(3) },
};

interface StoryOverlayLayerProps {
  textOverlay: StoryTextOverlay | null;
  stickers: StorySticker[];
  /** Dual-capture front photo rendered as a corner PiP over the media. */
  selfie?: StorySelfie | null;
  /** Omitted in the composer preview, where chips are inert. */
  onMentionPress?: (username: string) => void;
  onLinkPress?: (url: string) => void;
  /** When set the PiP is tappable (the viewer swaps which image is big). */
  onSelfiePress?: () => void;
}

/**
 * Renders a story's text overlay and sticker chips over the media. One
 * component for both the composer's live preview and the viewer so the two
 * can never drift apart. Mirrors the web StoryOverlayLayer.
 */
export function StoryOverlayLayer({
  textOverlay,
  stickers,
  selfie,
  onMentionPress,
  onLinkPress,
  onSelfiePress,
}: StoryOverlayLayerProps) {
  const interactive = !!onMentionPress || !!onLinkPress;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {selfie ? (
        <Pressable
          accessibilityRole={onSelfiePress ? "button" : "image"}
          accessibilityLabel={
            onSelfiePress ? "Swap which photo is big" : "Selfie photo"
          }
          disabled={!onSelfiePress}
          onPress={onSelfiePress}
          style={({ pressed }) => [
            styles.selfie,
            selfieCornerStyles[selfie.position],
            pressed && { opacity: 0.85 },
          ]}
        >
          <Image
            source={{ uri: selfie.url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={100}
            alt=""
          />
        </Pressable>
      ) : null}
      {POSITIONS.map((position) => {
        const text = textOverlay?.position === position ? textOverlay : null;
        const positionStickers = stickers.filter(
          (s) => s.position === position,
        );
        if (!text && positionStickers.length === 0) return null;

        return (
          <View
            key={position}
            pointerEvents="box-none"
            style={[styles.zone, zoneStyles[position]]}
          >
            {text ? (
              <Text
                style={[
                  styles.caption,
                  text.size === "large" && styles.captionLarge,
                ]}
              >
                {text.text}
              </Text>
            ) : null}
            {positionStickers.map((sticker, i) => (
              <Pressable
                key={`${sticker.type}-${i}`}
                accessibilityRole="button"
                accessibilityLabel={
                  sticker.type === "mention"
                    ? `Open profile of ${sticker.value}`
                    : `Open link ${sticker.value}`
                }
                disabled={!interactive}
                onPress={() =>
                  sticker.type === "mention"
                    ? onMentionPress?.(sticker.value)
                    : onLinkPress?.(sticker.value)
                }
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
              >
                <Ionicons
                  name={sticker.type === "mention" ? "at" : "link"}
                  size={14}
                  color={colors.primary}
                />
                <Text numberOfLines={1} style={styles.chipLabel}>
                  {sticker.type === "mention"
                    ? `@${sticker.value}`
                    : sticker.value.replace(/^https?:\/\//, "")}
                </Text>
              </Pressable>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const zoneStyles = StyleSheet.create({
  top: {
    top: "12%",
  },
  center: {
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  bottom: {
    bottom: "12%",
  },
});

const styles = StyleSheet.create({
  selfie: {
    position: "absolute",
    width: SELFIE_WIDTH_PCT,
    aspectRatio: SELFIE_ASPECT,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.9)",
    overflow: "hidden",
    backgroundColor: CHIP_BACKGROUND,
  },
  zone: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: spacing(2),
    paddingHorizontal: spacing(6),
  },
  caption: {
    color: OVERLAY_TEXT,
    fontWeight: "600",
    fontSize: 16,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  captionLarge: {
    fontSize: 24,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    maxWidth: 260,
    borderRadius: radii.full,
    backgroundColor: CHIP_BACKGROUND,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  chipLabel: {
    color: OVERLAY_TEXT,
    fontSize: 13.5,
    fontWeight: "600",
    flexShrink: 1,
  },
});
