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
import type { ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, spacing } from "@/lib/theme";

const BACKDROP = "rgba(0, 0, 0, 0.55)";
const FADE_MS = 160;
const SLIDE_MS = 200;
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 4;

export type ActionSheetOption = {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  /** Renders in the destructive color and is announced as such. */
  destructive?: boolean;
  description?: string;
};

/**
 * Bottom sheet of labelled choices, the themed replacement for Alert.alert
 * menus. The OS alert cannot be styled, ignores the app's palette, and
 * stacks its buttons in a shape that reads as a system error rather than a
 * deliberate choice.
 *
 * Backdrop fade and panel slide animate independently, and the slide is
 * kicked from a RAF so the panel has laid out at its off-screen position
 * before it moves. Same shell as ReportSheet.
 */
export function ActionSheet({
  visible,
  title,
  options,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: ActionSheetOption[];
  onClose: () => void;
}) {
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

  // Close first so the sheet is already on its way out while the action
  // runs; a push from an option would otherwise animate under the panel.
  const choose = (option: ActionSheetOption) => {
    onClose();
    option.onPress();
  };

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
          accessibilityLabel={`Close ${title.toLowerCase()} options`}
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
        <Text style={styles.title}>{title}</Text>

        <View style={styles.options}>
          {options.map((option) => (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              onPress={() => choose(option)}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.optionPressed,
              ]}
            >
              <Ionicons
                name={option.icon}
                size={20}
                color={option.destructive ? colors.destructive : colors.foreground}
              />
              <View style={styles.optionText}>
                <Text
                  style={[
                    styles.optionLabel,
                    option.destructive && styles.optionLabelDestructive,
                  ]}
                >
                  {option.label}
                </Text>
                {option.description ? (
                  <Text style={styles.optionDescription}>
                    {option.description}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onClose}
          style={({ pressed }) => [styles.cancel, pressed && styles.optionPressed]}
        >
          <Text style={styles.cancelLabel}>Cancel</Text>
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
    color: colors.mutedForeground,
    fontSize: 12.5,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingBottom: spacing(2),
  },
  options: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3.5),
  },
  optionPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  optionLabelDestructive: {
    color: colors.destructive,
  },
  optionDescription: {
    color: colors.mutedForeground,
    fontSize: 12.5,
  },
  cancel: {
    marginTop: spacing(2),
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    paddingVertical: spacing(3.5),
  },
  cancelLabel: {
    color: colors.mutedForeground,
    fontSize: 15,
    fontWeight: "600",
  },
});
