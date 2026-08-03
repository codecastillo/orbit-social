import { useEffect, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MESSAGE_REACTION_GLYPHS } from "@/lib/queries/messages";
import { colors, radii, spacing } from "@/lib/theme";

// Compact, iMessage-style card: small glyph targets and dense action rows
// so the popup reads as a sheet beside the bubble, not a full menu.
const BUTTON_SIZE = 36;
const BAR_PADDING = 6;
// +1 slot for the "+" any-emoji button at the end of the row.
const BAR_WIDTH =
  (MESSAGE_REACTION_GLYPHS.length + 1) * BUTTON_SIZE + BAR_PADDING * 2;
const BAR_HEIGHT = BUTTON_SIZE + BAR_PADDING * 2;
// Extra height per action row shown under the glyphs.
const ACTION_ROW_HEIGHT = 32;
const SCREEN_GUTTER = 16;

// One emoji grapheme: a pictographic base plus optional variation selector,
// skin tone, and ZWJ-joined continuations. Hermes supports \p{...} property
// escapes under the u flag.
const SINGLE_EMOJI_RE =
  /^\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])*(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])*)*$/u;

export interface ReactionBarAnchor {
  // Window coordinates of the long-pressed bubble, from measureInWindow.
  x: number;
  y: number;
  width: number;
}

export interface ReactionBarAction {
  label: string;
  /** Destructive actions (Report, Unsend) render in the danger color. */
  destructive?: boolean;
  onPress: () => void;
}

interface MessageReactionBarProps {
  visible: boolean;
  anchor: ReactionBarAnchor | null;
  existingEmojis: string[];
  onSelect: (emoji: string) => void;
  onClose: () => void;
  /** Action rows (Reply, Edit, Pin, ...) rendered under the reaction glyphs. */
  actions?: ReactionBarAction[];
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
  actions = [],
}: MessageReactionBarProps) {
  // Lazy useState instead of useRef: the values are stable across renders
  // and reading them in render stays within the react-hooks/refs rule.
  const [scale] = useState(() => new Animated.Value(0.8));
  const [opacity] = useState(() => new Animated.Value(0));
  // The "+" button swaps the glyph row for a one-emoji input, so any emoji
  // can react, not just the quick six.
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState("");

  // Reset the custom row whenever the bar reopens. Render-time adjustment
  // instead of an effect, mirroring the settings screen's name seeding.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setCustomOpen(false);
      setCustom("");
    }
  }

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
  const totalHeight = BAR_HEIGHT + actions.length * ACTION_ROW_HEIGHT;
  const top = Math.max(anchor.y - totalHeight - spacing(2), SCREEN_GUTTER);

  // React the instant a full emoji lands; the emoji keyboard inserts one
  // grapheme at a time, so no confirm button is needed.
  const handleCustomChange = (text: string) => {
    const candidate = text.trim();
    if (SINGLE_EMOJI_RE.test(candidate)) {
      onSelect(candidate);
      return;
    }
    setCustom(candidate);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss reactions">
        <Animated.View
          style={[
            styles.bar,
            // The plain glyph strip keeps its pill silhouette; the version
            // with action rows squares off into a card.
            { borderRadius: actions.length > 0 ? radii.lg : radii.full },
            { left, top, opacity, transform: [{ scale }] },
          ]}
          // Stop the backdrop press from swallowing taps on the row itself.
          onStartShouldSetResponder={() => true}
        >
          {customOpen ? (
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                value={custom}
                onChangeText={handleCustomChange}
                autoFocus
                placeholder="Any emoji"
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="React with any emoji"
              />
            </View>
          ) : (
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="React with any emoji"
                onPress={() => setCustomOpen(true)}
                style={({ pressed }) => [
                  styles.reaction,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="add" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={`${action.label} message`}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.actionRow,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={[
                  styles.actionLabel,
                  action.destructive && styles.actionLabelDanger,
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
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
    fontSize: 13,
    fontWeight: "600",
  },
  actionLabelDanger: {
    color: colors.destructive,
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
    fontSize: 20,
  },
  customRow: {
    width: BAR_WIDTH - BAR_PADDING * 2,
    height: BUTTON_SIZE,
    justifyContent: "center",
  },
  customInput: {
    height: BUTTON_SIZE - 4,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: 0,
    fontSize: 16,
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
