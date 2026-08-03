import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Avatar } from "@/components/ui";
import { RichText } from "@/components/rich-text";
import { normalizeAccent } from "@/lib/accents";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import type { AvatarBorderStyle, Profile } from "@/lib/queries/profiles";
import { colors, radii, spacing } from "@/lib/theme";

const EXCERPT_LENGTH = 140;

const AVATAR_FRAME_SIZE = 84;
const AVATAR_RING_WIDTH = 2;
const AVATAR_RING_INSET = 2;
const AVATAR_SIZE =
  AVATAR_FRAME_SIZE - (AVATAR_RING_WIDTH + AVATAR_RING_INSET) * 2;
// Frame ring at 30% alpha. Once stories ship, an active-story ring goes
// full strength; until then every avatar wears the muted frame.
const AVATAR_RING_ALPHA = "4D";
const AVATAR_RING_COLOR = `${colors.primary}${AVATAR_RING_ALPHA}`;

const COVER_HEIGHT = 120;

// RN has no gradient primitive without a new dependency, so the web
// UserAvatar's gradient borders flatten to a two-tone ring: the light
// gradient stop fills the frame, the dark stop draws its outer rim.
// gradient-rainbow and animated-glow are legacy stored values.
const BORDER_TONES: Partial<
  Record<AvatarBorderStyle, { fill: string; rim: string }>
> = {
  gold: { fill: "#fcd34d", rim: "#d97706" },
  silver: { fill: "#d4d4d8", rim: "#71717a" },
  diamond: { fill: "#a5f3fc", rim: "#818cf8" },
  "gradient-rainbow": { fill: "#f472b6", rim: colors.primary },
  "animated-glow": { fill: colors.primary, rim: colors.primary },
};

const ACTION_HEIGHT = 36;
const ACTION_RADIUS = 10;

function websiteHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function excerpt(content: string | null): string {
  if (!content) return "Shared a post";
  return content.length > EXCERPT_LENGTH
    ? `${content.slice(0, EXCERPT_LENGTH).trimEnd()}...`
    : content;
}

function Stat({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress?: () => void;
}) {
  if (!onPress) {
    return (
      <View style={styles.stat}>
        <Text style={styles.statValue}>{formatNumber(value)}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${label.toLowerCase()}`}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.statValue}>{formatNumber(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
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
  onPressFollowers,
  onPressFollowing,
}: {
  profile: Profile;
  actions?: ReactNode;
  onPressFollowers?: () => void;
  onPressFollowing?: () => void;
}) {
  const themeAccent = normalizeAccent(profile.theme_color);
  const borderTones =
    BORDER_TONES[(profile.avatar_border ?? "none") as AvatarBorderStyle];

  return (
    <View>
      {profile.cover_url ? (
        <Image
          source={{ uri: profile.cover_url }}
          style={styles.cover}
          contentFit="cover"
          transition={0}
          alt=""
        />
      ) : null}
      <View style={styles.container}>
      <View style={styles.topRow}>
        {/* Decorative avatar_border and the accent ring are mutually
            exclusive, same as the web profile hero: a decorative border
            replaces the frame's fill and rim, otherwise the muted ring
            picks up the profile accent when one is set. */}
        <View
          style={[
            styles.avatarFrame,
            profile.cover_url ? styles.avatarFrameOverCover : null,
            borderTones
              ? {
                  backgroundColor: borderTones.fill,
                  borderColor: borderTones.rim,
                }
              : themeAccent
                ? { borderColor: `${themeAccent}${AVATAR_RING_ALPHA}` }
                : null,
          ]}
        >
          <Avatar
            url={profile.avatar_url}
            name={profile.display_name}
            size={AVATAR_SIZE}
          />
        </View>
        <View style={styles.stats}>
          <Stat value={profile.post_count} label="Posts" />
          <Stat
            value={profile.follower_count}
            label="Followers"
            onPress={onPressFollowers}
          />
          <Stat
            value={profile.following_count}
            label="Following"
            onPress={onPressFollowing}
          />
        </View>
      </View>
      <View style={styles.nameRow}>
        <Text
          style={[
            styles.displayName,
            themeAccent ? { color: themeAccent } : null,
          ]}
        >
          {profile.display_name}
        </Text>
        {profile.is_verified ? (
          <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
        ) : null}
      </View>
      <Text style={styles.username}>@{profile.username}</Text>
      {profile.bio ? <RichText style={styles.bio}>{profile.bio}</RichText> : null}
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
      {profile.website ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open website ${websiteHost(profile.website)}`}
          onPress={() => {
            Linking.openURL(profile.website!).catch(() => {
              // Stored URLs are validated on save; nothing actionable.
            });
          }}
          style={({ pressed }) => [styles.websiteRow, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.websiteLabel}>ALSO ON</Text>
          <View style={styles.websiteChip}>
            <Ionicons
              name="globe-outline"
              size={12}
              color={colors.textSecondary}
            />
            <Text style={styles.websiteChipText} numberOfLines={1}>
              {websiteHost(profile.website)}
            </Text>
          </View>
        </Pressable>
      ) : null}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
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
  cover: {
    height: COVER_HEIGHT,
    backgroundColor: colors.surfaceElevated,
  },
  avatarFrame: {
    width: AVATAR_FRAME_SIZE,
    height: AVATAR_FRAME_SIZE,
    borderRadius: AVATAR_FRAME_SIZE / 2,
    borderWidth: AVATAR_RING_WIDTH,
    borderColor: AVATAR_RING_COLOR,
    // Opaque so the banner cannot show through the ring inset when the
    // avatar overlaps the cover.
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  // With a banner the avatar rides half over its bottom edge, like the web
  // profile hero.
  avatarFrameOverCover: {
    marginTop: -(AVATAR_FRAME_SIZE / 2),
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
  websiteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    marginTop: spacing(2),
  },
  websiteLabel: {
    color: colors.mutedForeground,
    fontSize: 10.5,
    fontWeight: "500",
    letterSpacing: 0.9,
  },
  websiteChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(2.5),
    paddingVertical: 5,
  },
  websiteChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "500",
    flexShrink: 1,
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
