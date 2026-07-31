import { useEffect, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MESSAGE_REACTION_GLYPHS } from "@/lib/queries/messages";
import { colors, radii, spacing } from "@/lib/theme";

const BUTTON_SIZE = 44;
const BAR_PADDING = 6;
const BAR_WIDTH = MESSAGE_REACTION_GLYPHS.length * BUTTON_SIZE + BAR_PADDING * 2;
const BAR_HEIGHT = BUTTON_SIZE + BAR_PADDING * 2;
// Extra height when the optional Reply action row is shown.
const ACTION_ROW_HEIGHT = 40;
const SCREEN_GUTTER = 16;

export interface ReactionBarAnchor {
  // Window coordinates of the long-pressed bubble, from measureInWindow.
  x: number;
  y: number;
  width: number;
}

interface MessageReactionBarProps {
  visible: boolean;
  anchor: ReactionBarAnchor | null;
  existingEmojis: string[];
  onSelect: (emoji: string) => void;
  onClose: () => void;
  /** When set, a "Reply" action row renders under the reaction glyphs. */
  onReply?: () => void;
}

/**
 * Long-press overlay with the six message reaction glyphs, floated above the
 * pressed bubble. Same Modal + measureInWindow approach as the post
 * ReactionPicker so it escapes the inverted list's clipping.
 */
export function MessageReactionBar({
  visible,
  anchor,
  existingEmojis,
  onSelect,
  onClose,
  onReply,
}: MessageReactionBarProps) {
  // Lazy useState instead of useRef: the values are stable across renders
  // and reading them in render stays within the react-hooks/refs rule.
  const [scale] = useState(() => new Animated.Value(0.8));
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      scale.setValue(0.8);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, scale, opacity]);

  if (!anchor) return null;

  const window = Dimensions.get("window");
  const left = Math.min(
    Math.max(anchor.x + anchor.width / 2 - BAR_WIDTH / 2, SCREEN_GUTTER),
    window.width - BAR_WIDTH - SCREEN_GUTTER,
  );
  const totalHeight = BAR_HEIGHT + (onReply ? ACTION_ROW_HEIGHT : 0);
  const top = Math.max(anchor.y - totalHeight - spacing(2), SCREEN_GUTTER);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss reactions">
        <Animated.View
          style={[
            styles.bar,
            // The plain glyph strip keeps its pill silhouette; the version
            // with the Reply row squares off into a card.
            { borderRadius: onReply ? radii.lg : radii.full },
            { left, top, opacity, transform: [{ scale }] },
          ]}
          // Stop the backdrop press from swallowing taps on the row itself.
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.glyphRow}>
            {MESSAGE_REACTION_GLYPHS.map(({ emoji, label }) => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`React with ${label}`}
                onPress={() => onSelect(emoji)}
                style={({ pressed }) => [
                  styles.reaction,
                  existingEmojis.includes(emoji) && styles.reactionActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.glyph}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          {onReply ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reply to message"
              onPress={onReply}
              style={({ pressed }) => [
                styles.actionRow,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.actionLabel}>Reply</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export interface ReactionPill {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface MessageReactionPillsProps {
  reactions: ReactionPill[];
  isMine: boolean;
  onToggle: (emoji: string) => void;
}

/**
 * Count cluster attached to a bubble's bottom corner, overlapping it slightly
 * like the web's MessageReactionsDisplay. Tapping a pill toggles that emoji.
 */
export function MessageReactionPills({
  reactions,
  isMine,
  onToggle,
}: MessageReactionPillsProps) {
  if (reactions.length === 0) return null;

  return (
    <View style={[styles.pillRow, isMine ? styles.pillRowMine : styles.pillRowTheirs]}>
      {reactions.map(({ emoji, count, hasReacted }) => (
        <Pressable
          key={emoji}
          accessibilityRole="button"
          accessibilityLabel={`${count} ${emoji} reactions${hasReacted ? ", including yours" : ""}`}
          onPress={() => onToggle(emoji)}
          style={({ pressed }) => [
            styles.pill,
            hasReacted && styles.pillMine,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.pillGlyph}>{emoji}</Text>
          <Text style={[styles.pillCount, hasReacted && styles.pillCountMine]}>
            {count}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  bar: {
    position: "absolute",
    padding: BAR_PADDING,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  glyphRow: {
    flexDirection: "row",
  },
  actionRow: {
    height: ACTION_ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: BAR_PADDING,
  },
  actionLabel: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  reaction: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  glyph: {
    fontSize: 24,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(1),
    // Overlap the bubble's bottom edge so the cluster reads as attached.
    marginTop: -8,
    zIndex: 1,
  },
  pillRowMine: {
    justifyContent: "flex-end",
    marginRight: spacing(2),
  },
  pillRowTheirs: {
    marginLeft: spacing(2),
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillMine: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  pillGlyph: {
    fontSize: 12,
  },
  pillCount: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  pillCountMine: {
    color: colors.primary,
  },
});
