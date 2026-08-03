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
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  type ListingSort,
} from "@/lib/queries/marketplace";
import { colors, radii, spacing } from "@/lib/theme";

const BACKDROP = "rgba(0, 0, 0, 0.55)";
const FADE_MS = 160;
const SLIDE_MS = 200;
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 4;

const SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

// Prices stay as raw input strings here; the marketplace screen parses them
// when building the query so a half-typed value never breaks the sheet.
export interface MarketplaceFilters {
  category: string;
  condition: string | null;
  priceMin: string;
  priceMax: string;
  sort: ListingSort;
}

export const DEFAULT_MARKETPLACE_FILTERS: MarketplaceFilters = {
  category: "All",
  condition: null,
  priceMin: "",
  priceMax: "",
  sort: "newest",
};

export function countActiveFilters(filters: MarketplaceFilters): number {
  let count = 0;
  if (filters.category !== "All") count += 1;
  if (filters.condition) count += 1;
  if (filters.priceMin.trim() || filters.priceMax.trim()) count += 1;
  if (filters.sort !== "newest") count += 1;
  return count;
}

/**
 * Bottom-sheet filter form for the marketplace browse screen. Same
 * backdrop-fade plus RAF-kicked slide as ReportSheet; see ClipCommentsSheet
 * for why the two layers animate independently.
 */
export function MarketplaceFilterSheet({
  visible,
  onClose,
  filters,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  filters: MarketplaceFilters;
  onApply: (filters: MarketplaceFilters) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [fade] = useState(() => new Animated.Value(0));
  const [slide] = useState(() => new Animated.Value(height));
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [draft, setDraft] = useState<MarketplaceFilters>(filters);

  // Re-seed the draft from the applied filters each time the sheet opens so a
  // dismissed edit does not linger. Render-time sync instead of an effect.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(filters);
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

  const setPrice = (key: "priceMin" | "priceMax") => (text: string) => {
    // Digits and one decimal point, matching the create screen's price field.
    const cleaned = text.replace(/[^0-9.]/g, "");
    setDraft((prev) => ({ ...prev, [key]: cleaned }));
  };

  const apply = () => {
    onApply(draft);
    onClose();
  };

  const reset = () => setDraft(DEFAULT_MARKETPLACE_FILTERS);

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
          accessibilityLabel="Close filters"
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

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Filters</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close filters"
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.formContent}
        >
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.chipWrap}>
              {LISTING_CATEGORIES.map((category) => {
                const active = draft.category === category;
                return (
                  <Pressable
                    key={category}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setDraft((prev) => ({ ...prev, category }))}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[styles.chipLabel, active && styles.chipLabelActive]}
                    >
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Condition</Text>
            <View style={styles.chipWrap}>
              {["Any", ...LISTING_CONDITIONS].map((condition) => {
                const active =
                  condition === "Any"
                    ? draft.condition === null
                    : draft.condition === condition;
                return (
                  <Pressable
                    key={condition}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() =>
                      setDraft((prev) => ({
                        ...prev,
                        condition: condition === "Any" ? null : condition,
                      }))
                    }
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[styles.chipLabel, active && styles.chipLabelActive]}
                    >
                      {condition}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Price</Text>
            <View style={styles.priceRow}>
              <View style={styles.priceWrap}>
                <Text style={styles.priceCurrency}>$</Text>
                <TextInput
                  value={draft.priceMin}
                  onChangeText={setPrice("priceMin")}
                  placeholder="Min"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="decimal-pad"
                  maxLength={10}
                  style={styles.priceInput}
                />
              </View>
              <Text style={styles.priceDash}>to</Text>
              <View style={styles.priceWrap}>
                <Text style={styles.priceCurrency}>$</Text>
                <TextInput
                  value={draft.priceMax}
                  onChangeText={setPrice("priceMax")}
                  placeholder="Max"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="decimal-pad"
                  maxLength={10}
                  style={styles.priceInput}
                />
              </View>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Sort</Text>
            <View style={styles.sortList}>
              {SORT_OPTIONS.map((option) => {
                const active = draft.sort === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() =>
                      setDraft((prev) => ({ ...prev, sort: option.value }))
                    }
                    style={({ pressed }) => [
                      styles.sortRow,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons
                      name={active ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={active ? colors.primary : colors.mutedForeground}
                    />
                    <Text
                      style={[styles.sortLabel, active && styles.sortLabelActive]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.buttonRow}>
            <View style={styles.buttonHalf}>
              <Button label="Reset" variant="outline" onPress={reset} />
            </View>
            <View style={styles.buttonHalf}>
              <Button label="Apply" onPress={apply} />
            </View>
          </View>
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
  formContent: {
    paddingTop: spacing(3),
    gap: spacing(4),
  },
  field: {
    gap: spacing(1.5),
  },
  fieldLabel: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "600",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(2),
  },
  chip: {
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing(3),
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  chipLabelActive: {
    color: colors.primaryForeground,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
  },
  priceWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(3.5),
  },
  priceCurrency: {
    color: colors.mutedForeground,
    fontSize: 14,
    fontWeight: "600",
    marginRight: spacing(1.5),
  },
  priceInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 14,
    paddingVertical: spacing(2.5),
  },
  priceDash: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  sortList: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sortLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  sortLabelActive: {
    color: colors.foreground,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing(2.5),
  },
  buttonHalf: {
    flex: 1,
  },
});
