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
import { AvatarRing, avatarRingInnerSize } from "@/components/avatar-ring";
import { RichText } from "@/components/rich-text";
import { normalizeAccent } from "@/lib/accents";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { activeStatus, type Profile } from "@/lib/queries/profiles";
import { colors, radii, spacing } from "@/lib/theme";

const EXCERPT_LENGTH = 140;

const AVATAR_FRAME_SIZE = 72;
const AVATAR_SIZE = avatarRingInnerSize(AVATAR_FRAME_SIZE);

const COVER_HEIGHT = 96;

const ACTION_HEIGHT = 32;

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
  const content = (
    <>
      <Text style={styles.statValue}>{formatNumber(value)}</Text>
      <Text style={styles.statLabel}> {label}</Text>
    </>
  );
  if (!onPress) {
    return <View style={styles.stat}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${label.toLowerCase()}`}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.stat, pressed && { opacity: 0.6 }]}
    >
      {content}
    </Pressable>
  );
}

/**
 * Compact outline button for the profile action row. Primary carries the
 * violet border and label, secondary the hairline surface border; pass a pair
 * inside the header's `actions` slot and they split the row evenly.
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
          color={variant === "primary" ? colors.primary : colors.foreground}
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
  topAction,
  onPressFollowers,
  onPressFollowing,
  onPressUsername,
}: {
  profile: Profile;
  actions?: ReactNode;
  /** Ghost icon button pinned to the right of the identity row (the
      own-profile settings gear once the nav header is hidden). */
  topAction?: ReactNode;
  onPressFollowers?: () => void;
  onPressFollowing?: () => void;
  /** Turns the @username into the account switcher trigger on own profile. */
  onPressUsername?: () => void;
}) {
  const themeAccent = normalizeAccent(profile.theme_color);
  // Expired statuses are not cleared server-side, so presence of the text is
  // never enough on its own.
  const status = activeStatus(profile);

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
        <View style={styles.identityRow}>
          <AvatarRing
            size={AVATAR_FRAME_SIZE}
            border={profile.avatar_border}
            accent={themeAccent}
            style={profile.cover_url ? styles.avatarFrameOverCover : null}
          >
            <Avatar
              url={profile.avatar_url}
              name={profile.display_name}
              size={AVATAR_SIZE}
            />
          </AvatarRing>
          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text
                style={[
                  styles.displayName,
                  themeAccent ? { color: themeAccent } : null,
                ]}
                numberOfLines={1}
              >
                {profile.display_name}
              </Text>
              {profile.is_verified ? (
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={colors.primary}
                />
              ) : null}
            </View>
            {onPressUsername ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Switch account"
                onPress={onPressUsername}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.usernameRow,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.username}>@{profile.username}</Text>
                <Ionicons
                  name="chevron-down"
                  size={13}
                  color={colors.mutedForeground}
                />
              </Pressable>
            ) : (
              <Text style={styles.username}>@{profile.username}</Text>
            )}
            <View style={styles.statsLine}>
              <Stat value={profile.post_count} label="Posts" />
              <Text style={styles.statDot}>·</Text>
              <Stat
                value={profile.follower_count}
                label="Followers"
                onPress={onPressFollowers}
              />
              <Text style={styles.statDot}>·</Text>
              <Stat
                value={profile.following_count}
                label="Following"
                onPress={onPressFollowing}
              />
            </View>
          </View>
          {topAction ? (
            <View style={styles.topAction}>{topAction}</View>
          ) : null}
        </View>
        {status ? (
          <View style={styles.statusRow}>
            <Text style={styles.statusText} numberOfLines={2}>
              {status}
            </Text>
          </View>
        ) : null}
        {profile.pronouns ? (
          <Text style={styles.pronouns}>{profile.pronouns}</Text>
        ) : null}
        {profile.bio ? (
          <RichText style={styles.bio}>{profile.bio}</RichText>
        ) : null}
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
        {(profile.links ?? []).map((link) => (
          <Pressable
            key={link.url}
            accessibilityRole="link"
            accessibilityLabel={`Open ${link.label}`}
            onPress={() => {
              Linking.openURL(link.url).catch(() => {
                // Stored URLs are validated on save; nothing actionable.
              });
            }}
            style={({ pressed }) => [
              styles.websiteRow,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons
              name="link-outline"
              size={13}
              color={colors.mutedForeground}
            />
            <Text style={styles.websiteText} numberOfLines={1}>
              {link.label}
            </Text>
          </Pressable>
        ))}
        {profile.website ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open website ${websiteHost(profile.website)}`}
            onPress={() => {
              Linking.openURL(profile.website!).catch(() => {
                // Stored URLs are validated on save; nothing actionable.
              });
            }}
            style={({ pressed }) => [
              styles.websiteRow,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons
              name="globe-outline"
              size={13}
              color={colors.mutedForeground}
            />
            <Text style={styles.websiteText} numberOfLines={1}>
              {websiteHost(profile.website)}
            </Text>
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
      <View style={styles.identityRow}>
        <AvatarRing size={AVATAR_FRAME_SIZE}>
          <View style={styles.skeletonAvatar} />
        </AvatarRing>
        <View style={styles.nameBlock}>
          <View style={styles.skeletonName} />
          <View style={styles.skeletonUsername} />
          <View style={styles.skeletonStatsLine} />
        </View>
      </View>
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
    paddingHorizontal: spacing(3),
    paddingTop: spacing(3),
    paddingBottom: spacing(3.5),
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cover: {
    height: COVER_HEIGHT,
    backgroundColor: colors.surfaceElevated,
  },
  // With a banner the avatar rides half over its bottom edge, like the web
  // profile hero; the name block stays clear of the banner to its right.
  avatarFrameOverCover: {
    marginTop: -(AVATAR_FRAME_SIZE / 2),
  },
  nameBlock: {
    flex: 1,
    marginLeft: spacing(3),
  },
  topAction: {
    marginLeft: spacing(2),
    alignSelf: "flex-start",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  displayName: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  username: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 1,
  },
  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 3,
  },
  statsLine: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: spacing(2),
  },
  stat: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  statValue: {
    color: colors.foreground,
    fontSize: 12.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    color: colors.mutedForeground,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statDot: {
    color: colors.textFaint,
    fontSize: 10,
    marginHorizontal: spacing(1),
  },
  bio: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing(2.5),
  },
  // A status is a passing note, so it reads quieter than the bio and sits
  // above it rather than competing with it.
  statusRow: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    marginBottom: spacing(2),
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  pronouns: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginBottom: spacing(1),
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
    gap: 4,
    marginTop: spacing(1),
  },
  websiteText: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: "500",
    flexShrink: 1,
  },
  actions: {
    flexDirection: "row",
    gap: spacing(2),
    marginTop: spacing(3),
  },
  actionButton: {
    flex: 1,
    height: ACTION_HEIGHT,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing(2.5),
  },
  actionButtonPrimary: {
    borderColor: colors.primary,
  },
  actionLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
  },
  actionLabelPrimary: {
    color: colors.primary,
  },
  skeletonAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonName: {
    width: 132,
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    marginTop: spacing(1),
  },
  skeletonUsername: {
    width: 88,
    height: 11,
    borderRadius: 4,
    backgroundColor: colors.surface,
    marginTop: spacing(2),
  },
  skeletonStatsLine: {
    width: 176,
    height: 10,
    borderRadius: 4,
    backgroundColor: colors.surface,
    marginTop: spacing(2.5),
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
    borderRadius: radii.sm,
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
