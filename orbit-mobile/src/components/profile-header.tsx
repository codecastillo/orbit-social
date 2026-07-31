import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components/ui";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import type { Profile } from "@/lib/queries/profiles";
import { colors, spacing } from "@/lib/theme";

const EXCERPT_LENGTH = 140;

const AVATAR_FRAME_SIZE = 84;
const AVATAR_RING_WIDTH = 2;
const AVATAR_RING_INSET = 2;
const AVATAR_SIZE =
  AVATAR_FRAME_SIZE - (AVATAR_RING_WIDTH + AVATAR_RING_INSET) * 2;
// Frame ring at 30% primary. Once stories ship, an active-story ring goes
// full primary; until then every avatar wears the muted frame.
const AVATAR_RING_COLOR = `${colors.primary}4D`;

const ACTION_HEIGHT = 36;
const ACTION_RADIUS = 10;

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

/**
 * Compact filled button for the profile action row. Primary is the violet
 * fill, secondary the elevated-surface fill; pass a pair inside the header's
 * `actions` slot and they split the row evenly.
 */
export function ProfileActionButton({
  label,
  variant = "secondary",
  loading = false,
  disabled,
  ...rest
}: PressableProps & {
  label: string;
  variant?: "primary" | "secondary";
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.actionButton,
        variant === "primary" && styles.actionButtonPrimary,
        pressed && { opacity: 0.85 },
        isDisabled && { opacity: 0.6 },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === "primary" ? colors.primaryForeground : colors.foreground
          }
        />
      ) : (
        <Text
          style={[
            styles.actionLabel,
            variant === "primary" && styles.actionLabelPrimary,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function ProfileHeader({
  profile,
  actions,
}: {
  profile: Profile;
  actions?: ReactNode;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.avatarFrame}>
          <Avatar
            url={profile.avatar_url}
            name={profile.display_name}
            size={AVATAR_SIZE}
          />
        </View>
        <View style={styles.stats}>
          <Stat value={profile.post_count} label="Posts" />
          <Stat value={profile.follower_count} label="Followers" />
          <Stat value={profile.following_count} label="Following" />
        </View>
      </View>
      <View style={styles.nameRow}>
        <Text style={styles.displayName}>{profile.display_name}</Text>
        {profile.is_verified ? (
          <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
        ) : null}
      </View>
      <Text style={styles.username}>@{profile.username}</Text>
      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      {profile.location ? (
        <View style={styles.locationRow}>
          <Ionicons
            name="location-outline"
            size={13}
            color={colors.mutedForeground}
          />
          <Text style={styles.location}>{profile.location}</Text>
        </View>
      ) : null}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

/** Placeholder mirroring the header layout while the profile loads. */
export function ProfileHeaderSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.avatarFrame}>
          <View style={styles.skeletonAvatar} />
        </View>
        <View style={styles.stats}>
          {["posts", "followers", "following"].map((key) => (
            <View key={key} style={styles.stat}>
              <View style={styles.skeletonStatValue} />
              <View style={styles.skeletonStatLabel} />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.skeletonName} />
      <View style={styles.skeletonUsername} />
      <View style={styles.skeletonBio} />
      <View style={styles.actions}>
        <View style={styles.skeletonAction} />
        <View style={styles.skeletonAction} />
      </View>
    </View>
  );
}

/**
 * Compact post row for the profile list tab: author name plus relative time
 * on top, a trimmed excerpt below. Shared by the own-profile tab and the
 * public profile screen.
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
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    paddingBottom: spacing(4),
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarFrame: {
    width: AVATAR_FRAME_SIZE,
    height: AVATAR_FRAME_SIZE,
    borderRadius: AVATAR_FRAME_SIZE / 2,
    borderWidth: AVATAR_RING_WIDTH,
    borderColor: AVATAR_RING_COLOR,
    alignItems: "center",
    justifyContent: "center",
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
    gap: 4,
    marginTop: spacing(3),
  },
  displayName: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  username: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 1,
  },
  bio: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
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
  actions: {
    flexDirection: "row",
    gap: spacing(2),
    marginTop: spacing(3.5),
  },
  actionButton: {
    flex: 1,
    height: ACTION_HEIGHT,
    borderRadius: ACTION_RADIUS,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing(3),
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  actionLabel: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  actionLabelPrimary: {
    color: colors.primaryForeground,
  },
  skeletonAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonStatValue: {
    width: 28,
    height: 16,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonStatLabel: {
    width: 48,
    height: 9,
    borderRadius: 4,
    backgroundColor: colors.surface,
    marginTop: 6,
  },
  skeletonName: {
    width: 132,
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    marginTop: spacing(3.5),
  },
  skeletonUsername: {
    width: 88,
    height: 11,
    borderRadius: 4,
    backgroundColor: colors.surface,
    marginTop: spacing(2),
  },
  skeletonBio: {
    alignSelf: "stretch",
    height: 11,
    borderRadius: 4,
    backgroundColor: colors.surface,
    marginTop: spacing(2.5),
  },
  skeletonAction: {
    flex: 1,
    height: ACTION_HEIGHT,
    borderRadius: ACTION_RADIUS,
    backgroundColor: colors.surfaceElevated,
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
