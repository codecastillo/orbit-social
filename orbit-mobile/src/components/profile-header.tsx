import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components/ui";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import type { Profile } from "@/lib/queries/profiles";
import { colors, spacing } from "@/lib/theme";

const EXCERPT_LENGTH = 140;

function excerpt(content: string | null): string {
  if (!content) return "Shared a post";
  return content.length > EXCERPT_LENGTH
    ? `${content.slice(0, EXCERPT_LENGTH).trimEnd()}...`
    : content;
}

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
        <Avatar url={profile.avatar_url} name={profile.display_name} size={96} />
        <View style={styles.stats}>
          <Stat value={profile.post_count} label="Posts" />
          <Stat value={profile.follower_count} label="Followers" />
          <Stat value={profile.following_count} label="Following" />
        </View>
      </View>
      <View style={styles.nameRow}>
        <Text style={styles.displayName}>{profile.display_name}</Text>
        {profile.is_verified ? (
          <Ionicons name="checkmark-circle" size={17} color={colors.primary} />
        ) : null}
      </View>
      <Text style={styles.username}>@{profile.username}</Text>
      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      {profile.location ? (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
          <Text style={styles.location}>{profile.location}</Text>
        </View>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

/**
 * Compact post row for profile screens: author name plus relative time on
 * top, a trimmed excerpt below. Shared by the own-profile tab and the public
 * profile screen.
 */
export function ProfilePostRow({
  authorName,
  content,
  createdAt,
  onPress,
}: {
  authorName: string;
  content: string | null;
  createdAt: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.postRow, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.postMeta}>
        <Text style={styles.postAuthor}>{authorName}</Text>
        <Text style={styles.postTime}>{formatTimeAgo(createdAt)}</Text>
      </View>
      <Text style={styles.postContent}>{excerpt(content)}</Text>
    </Pressable>
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
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
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
    marginTop: spacing(3.5),
  },
  displayName: {
    color: colors.foreground,
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.4,
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
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing(1.5),
  },
  location: {
    color: colors.mutedForeground,
    fontSize: 12.5,
  },
  action: {
    marginTop: spacing(4),
  },
  postRow: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  postMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  postAuthor: {
    color: colors.foreground,
    fontSize: 13.5,
    fontWeight: "600",
  },
  postTime: {
    color: colors.textFaint,
    fontSize: 12,
  },
  postContent: {
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 4,
  },
});
