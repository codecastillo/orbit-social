import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import type { Profile } from "@/lib/queries/profiles";
import { colors, spacing } from "@/lib/theme";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{formatNumber(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function ProfileHeader({
  profile,
  action,
}: {
  profile: Profile;
  action?: ReactNode;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Avatar url={profile.avatar_url} name={profile.display_name} size={72} />
        <View style={styles.stats}>
          <Stat value={profile.post_count} label="Posts" />
          <Stat value={profile.follower_count} label="Followers" />
          <Stat value={profile.following_count} label="Following" />
        </View>
      </View>
      <View style={styles.nameRow}>
        <Text style={styles.displayName}>{profile.display_name}</Text>
        {profile.is_verified ? (
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
        ) : null}
      </View>
      <Text style={styles.username}>@{profile.username}</Text>
      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stats: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginLeft: spacing(4),
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  statLabel: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: spacing(3),
  },
  displayName: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "700",
  },
  username: {
    color: colors.mutedForeground,
    fontSize: 13.5,
    marginTop: 2,
  },
  bio: {
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: spacing(2),
  },
  action: {
    marginTop: spacing(4),
  },
});
