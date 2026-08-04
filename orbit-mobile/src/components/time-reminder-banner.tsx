import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTimeOnOrbitTracker } from "@/lib/hooks/use-time-on-orbit";
import { useIsOnline } from "@/lib/hooks/use-is-online";
import { OFFLINE_BANNER_HEIGHT } from "@/components/offline-banner";
import { colors, radii, spacing } from "@/lib/theme";

/**
 * Hosts the time-on-Orbit tracker and renders its once-a-day reminder as a
 * dismissible banner. Mounted once in the root layout, styled to match the
 * undo snackbar but anchored to the top so it never covers the tab bar.
 */
export function TimeReminderBanner() {
  const { reminder, dismissReminder } = useTimeOnOrbitTracker();
  const insets = useSafeAreaInsets();
  const online = useIsOnline();

  if (!reminder) return null;

  const top =
    insets.top + spacing(2) + (online ? 0 : OFFLINE_BANNER_HEIGHT);

  return (
    <View pointerEvents="box-none" style={[styles.host, { top }]}>
      <View style={styles.banner}>
        <Ionicons name="time-outline" size={16} color={colors.mutedForeground} />
        <Text style={styles.message} numberOfLines={2}>
          {reminder}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss reminder"
          onPress={dismissReminder}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="close" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: spacing(4),
    right: spacing(4),
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  message: {
    flex: 1,
    color: colors.foreground,
    fontSize: 13.5,
  },
});
