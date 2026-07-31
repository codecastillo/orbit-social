import { useEffect, useState } from "react";
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text } from "react-native";
import {
  REACTION_EMOJI,
  REACTION_LABELS,
  REACTION_TYPES,
  type ReactionType,
} from "@/lib/queries/reactions";
import { colors, radii, spacing } from "@/lib/theme";

const BUTTON_SIZE = 44;
const PICKER_PADDING = 6;
const PICKER_WIDTH = REACTION_TYPES.length * BUTTON_SIZE + PICKER_PADDING * 2;
const PICKER_HEIGHT = BUTTON_SIZE + PICKER_PADDING * 2;
const SCREEN_GUTTER = 16;

export interface ReactionAnchor {
  // Window coordinates of the like button, from measureInWindow.
  x: number;
  y: number;
}

interface ReactionPickerProps {
  visible: boolean;
  anchor: ReactionAnchor | null;
  currentReaction: ReactionType | null;
  onSelect: (type: ReactionType) => void;
  onClose: () => void;
}

/**
 * Long-press overlay with the six reaction glyphs, floated above the like
 * button. Rendered in a transparent Modal so it escapes list clipping;
 * tapping anywhere outside dismisses it.
 */
export function ReactionPicker({
  visible,
  anchor,
  currentReaction,
  onSelect,
  onClose,
}: ReactionPickerProps) {
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
    Math.max(anchor.x - PICKER_WIDTH / 4, SCREEN_GUTTER),
    window.width - PICKER_WIDTH - SCREEN_GUTTER,
  );
  const top = Math.max(anchor.y - PICKER_HEIGHT - spacing(2), SCREEN_GUTTER);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss reactions">
        <Animated.View
          style={[styles.picker, { left, top, opacity, transform: [{ scale }] }]}
          // Stop the backdrop press from swallowing taps on the row itself.
          onStartShouldSetResponder={() => true}
        >
          {REACTION_TYPES.map((type) => (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityLabel={`React with ${REACTION_LABELS[type]}`}
              onPress={() => onSelect(type)}
              style={({ pressed }) => [
                styles.reaction,
                currentReaction === type && styles.reactionActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.glyph}>{REACTION_EMOJI[type]}</Text>
            </Pressable>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  picker: {
    position: "absolute",
    flexDirection: "row",
    padding: PICKER_PADDING,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
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
});
