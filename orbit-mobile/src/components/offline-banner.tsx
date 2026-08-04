import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useIsOnline } from "@/lib/hooks/use-is-online";
import { colors, spacing } from "@/lib/theme";

/** Banner height, so other top-anchored chrome can sit below it. */
export const OFFLINE_BANNER_HEIGHT = 30;

/**
 * Shell-level connection strip. Mounted once in the root layout above the
 * navigator, it is the one place that says the network is gone; screens keep
 * rendering whatever they already have.
 */
export function OfflineBanner() {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();

  if (online) return null;

  return (
    <View style={[styles.banner, { top: insets.top }]}>
      <Ionicons name="cloud-offline-outline" size={14} color={colors.textSecondary} />
      <Text style={styles.message}>No connection. Orbit will catch up when you are back.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 0,
    right: 0,
    height: OFFLINE_BANNER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
