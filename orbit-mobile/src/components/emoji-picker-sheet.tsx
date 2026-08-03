import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  EMOJI_GRID,
  REACTION_QUICK_ROW,
  addRecentEmoji,
  getRecentEmoji,
  isSingleEmoji,
} from "@/lib/reactions";
import { colors, radii, spacing } from "@/lib/theme";

const BACKDROP = "rgba(0, 0, 0, 0.55)";
const FADE_MS = 160;
const SLIDE_MS = 200;
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 4;
const GRID_COLUMNS = 8;

interface EmojiPickerSheetProps {
  visible: boolean;
  /** Fired with the chosen emoji; the sheet records it into recents itself. */
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

/**
 * Full emoji picker behind the "+" in every reaction bar: quick row,
 * device-local recents, the curated grid, and a one-emoji input so any
 * emoji the keyboard offers can react. Same backdrop-fade plus RAF-kicked
 * slide as ReportSheet.
 */
export function EmojiPickerSheet({ visible, onSelect, onClose }: EmojiPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [fade] = useState(() => new Animated.Value(0));
  const [slide] = useState(() => new Animated.Value(height));
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const [custom, setCustom] = useState("");

  // Reset the input whenever the sheet reopens. Render-time adjustment
  // instead of an effect, mirroring the message reaction bar.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setCustom("");
  }

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvt, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const onHide = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      fade.setValue(0);
      slide.setValue(height);
      return;
    }
    getRecentEmoji().then(setRecents);
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

  const select = (emoji: string) => {
    // Fire and forget; a lost recents write never blocks the reaction.
    void addRecentEmoji(emoji);
    onSelect(emoji);
  };

  // React the instant a full emoji lands; the emoji keyboard inserts one
  // grapheme at a time, so no confirm button is needed.
  const handleCustomChange = (text: string) => {
    const candidate = text.trim();
    if (isSingleEmoji(candidate)) {
      select(candidate);
      return;
    }
    setCustom(candidate);
  };

  const renderRow = (emojis: readonly string[]) => (
    <View style={styles.grid}>
      {emojis.map((emoji) => (
        <Pressable
          key={emoji}
          accessibilityRole="button"
          accessibilityLabel={`React with ${emoji}`}
          onPress={() => select(emoji)}
          style={({ pressed }) => [styles.cell, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.cellGlyph}>{emoji}</Text>
        </Pressable>
      ))}
    </View>
  );

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
          accessibilityLabel="Dismiss emoji picker"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            bottom: keyboardHeight,
            paddingBottom:
              keyboardHeight > 0 ? spacing(3) : insets.bottom + spacing(3),
            transform: [{ translateY: slide }],
          },
        ]}
      >
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        <TextInput
          style={styles.customInput}
          value={custom}
          onChangeText={handleCustomChange}
          autoFocus
          placeholder="Any emoji"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel="React with any emoji"
        />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.body}
        >
          {renderRow(REACTION_QUICK_ROW.map((r) => r.emoji))}
          {recents.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Recent</Text>
              {renderRow(recents)}
            </>
          ) : null}
          <Text style={styles.sectionLabel}>Emoji</Text>
          {renderRow(EMOJI_GRID)}
        </ScrollView>
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
    maxHeight: "60%",
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
  customInput: {
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: 0,
    fontSize: 16,
    marginBottom: spacing(2),
  },
  body: {
    paddingBottom: spacing(2),
  },
  sectionLabel: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
    marginTop: spacing(2),
    marginBottom: spacing(1),
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / GRID_COLUMNS}%`,
    paddingVertical: spacing(1.5),
    alignItems: "center",
    justifyContent: "center",
  },
  cellGlyph: {
    fontSize: 26,
  },
});
