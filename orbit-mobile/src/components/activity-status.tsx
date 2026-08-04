import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";
import type { Presence } from "@/lib/queries/presence";

/**
 * Activity status for a DM counterpart: a green dot while they are online,
 * "Active 5m ago" once they are not. Renders nothing when presence is null,
 * which covers both a hidden counterpart and a viewer who hides their own.
 */
export function ActivityStatus({ presence }: { presence: Presence | null }) {
  if (!presence) return null;

  return (
    <View style={styles.row}>
      {presence.online ? <View style={styles.inlineDot} /> : null}
      <Text style={styles.label} numberOfLines={1}>
        {presence.label}
      </Text>
    </View>
  );
}

/** Dot-only variant for avatar corners in dense list rows. */
export function ActivityDot({ presence }: { presence: Presence | null }) {
  if (!presence?.online) return null;

  return (
    <View
      accessible
      accessibilityLabel="Active now"
      style={styles.avatarDot}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
  },
  inlineDot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.success,
  },
  label: {
    color: colors.mutedForeground,
    fontSize: 12,
    flexShrink: 1,
  },
  avatarDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: radii.full,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background,
  },
});
