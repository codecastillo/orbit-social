import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { ProfilePostRow } from "@/components/profile-header";
import {
  getUserClips,
  getUserMentions,
  type MentionPost,
  type ProfilePost,
} from "@/lib/queries/profiles";
import { useVideoFrame } from "@/lib/video-frame";
import { colors, spacing } from "@/lib/theme";

const GRID_GAP = 2;
const GRID_COLUMNS = 3;
// Small radius so the grid reads as cards on the dark surface instead of
// flush squares.
const TILE_RADIUS = 6;

type ProfileTab = "posts" | "clips" | "mentions";

const TABS: { key: ProfileTab; label: string }[] = [
  { key: "posts", label: "Posts" },
  { key: "clips", label: "Clips" },
  { key: "mentions", label: "Mentions" },
];

/**
 * Quick-access tile pinned to the front of the own-profile Posts grid
 * (Drafts, Scheduled). Never shown on other users' profiles.
 */
export interface ProfileGridShortcut {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count: number;
  onPress: () => void;
}

function ProfileTabBar({
  active,
  onChange,
}: {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(tab.key)}
            style={styles.tab}
          >
            <Text
              style={[styles.tabLabel, isActive && styles.tabLabelActive]}
            >
              {tab.label}
            </Text>
            <View
              style={[
                styles.tabUnderline,
                isActive && styles.tabUnderlineActive,
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function ShortcutTile({
  shortcut,
  size,
}: {
  shortcut: ProfileGridShortcut;
  size: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${shortcut.label}, ${shortcut.count}`}
      onPress={shortcut.onPress}
      style={({ pressed }) => [
        styles.shortcutTile,
        { width: size, height: size },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Ionicons name={shortcut.icon} size={22} color={colors.mutedForeground} />
      <Text style={styles.shortcutLabel}>{shortcut.label}</Text>
      <View style={styles.shortcutCount}>
        <Text style={styles.shortcutCountText}>{shortcut.count}</Text>
      </View>
    </Pressable>
  );
}

function MediaTile({
  post,
  size,
  onPress,
}: {
  post: ProfilePost;
  size: number;
  onPress: () => void;
}) {
  const media = [...post.post_media].sort(
    (a, b) => a.sort_order - b.sort_order,
  )[0];
  const isVideo = media.type === "video" || post.type === "video" || post.type === "reel";
  const needsFrame = isVideo && !media.thumbnail_url;
  const frame = useVideoFrame(needsFrame ? media.url : null);
  const source = needsFrame ? frame : (media.thumbnail_url ?? media.url);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.mediaTile,
        { width: size, height: size },
        pressed && { opacity: 0.8 },
      ]}
    >
      {source ? (
        <Image
          source={{ uri: source }}
          alt={post.content ?? "Post media"}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.tilePlaceholder]} />
      )}
      {post.post_media.length > 1 ? (
        <Ionicons name="layers" size={14} color="#fff" style={styles.tileBadge} />
      ) : isVideo ? (
        <Ionicons name="play" size={14} color="#fff" style={styles.tileBadge} />
      ) : null}
      {isVideo && media.duration_ms ? (
        <Text style={styles.tileDuration}>{formatTileDuration(media.duration_ms)}</Text>
      ) : null}
    </Pressable>
  );
}

function formatTileDuration(durationMs: number): string {
  const total = Math.round(durationMs / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Text-only posts keep their spot in the grid as quote-style tiles, so the
// Posts tab holds the user's whole timeline, not just photos.
function TextTile({
  post,
  size,
  onPress,
}: {
  post: ProfilePost;
  size: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.textTile,
        { width: size, height: size },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={styles.textTileContent} numberOfLines={6}>
        {post.content}
      </Text>
    </Pressable>
  );
}

/**
 * Profile body below the header: Posts / Clips / Mentions tabs. Posts is the
 * user's timeline as a 3-column grid (media tiles plus text tiles); Clips is
 * their reels; Mentions is other people's posts that tag the username.
 */
export function ProfileContent({
  header,
  posts,
  isPending,
  isError,
  onRetry,
  userId,
  username,
  onPressPost,
  onRefresh,
  shortcuts,
}: {
  header: ReactNode;
  posts: ProfilePost[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  userId: string;
  username: string;
  onPressPost: (postId: string) => void;
  /** Pull-to-refresh for whatever the caller renders in `header`; the
   *  active tab's own query is refetched alongside it. */
  onRefresh?: () => Promise<unknown> | void;
  /** Own-profile only: Drafts/Scheduled tiles pinned before the Posts grid. */
  shortcuts?: ProfileGridShortcut[];
}) {
  const [tab, setTab] = useState<ProfileTab>("posts");
  const { width } = useWindowDimensions();
  const tileSize = (width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const clipsQuery = useQuery({
    queryKey: ["profile-clips", userId],
    queryFn: () => getUserClips(userId),
    enabled: tab === "clips",
  });
  const mentionsQuery = useQuery({
    queryKey: ["profile-mentions", userId],
    queryFn: () => getUserMentions(username, userId),
    enabled: tab === "mentions",
  });

  const isGridTab = tab !== "mentions";
  const gridData = tab === "posts" ? (posts ?? []) : (clipsQuery.data ?? []);
  const pending =
    tab === "posts"
      ? isPending
      : tab === "clips"
        ? clipsQuery.isPending
        : mentionsQuery.isPending;
  const errored =
    tab === "posts"
      ? isError
      : tab === "clips"
        ? clipsQuery.isError
        : mentionsQuery.isError;
  const retry =
    tab === "posts"
      ? onRetry
      : tab === "clips"
        ? clipsQuery.refetch
        : mentionsQuery.refetch;

  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([onRefresh?.(), retry()]);
    } finally {
      setRefreshing(false);
    }
  }

  const emptyCopy =
    tab === "posts"
      ? { icon: "camera-outline" as const, text: "No posts yet" }
      : tab === "clips"
        ? { icon: "film-outline" as const, text: "No clips yet" }
        : { icon: "at-outline" as const, text: "No mentions yet" };

  return (
    <FlatList
      // numColumns cannot change on a mounted FlatList; keying by tab
      // remounts the list when the segmented control switches.
      key={tab}
      data={
        (isGridTab
          ? tab === "posts" && shortcuts?.length
            ? [...shortcuts, ...gridData]
            : gridData
          : (mentionsQuery.data ?? [])) as (
          | ProfilePost
          | MentionPost
          | ProfileGridShortcut
        )[]
      }
      numColumns={isGridTab ? GRID_COLUMNS : 1}
      columnWrapperStyle={isGridTab ? styles.gridRow : undefined}
      keyExtractor={(item) => (item as { id: string }).id}
      ListHeaderComponent={
        <View>
          {header}
          <ProfileTabBar active={tab} onChange={setTab} />
        </View>
      }
      renderItem={({ item }) => {
        if (!isGridTab) {
          const mention = item as MentionPost;
          return (
            <ProfilePostRow
              authorName={mention.profiles.display_name || mention.profiles.username}
              content={mention.content}
              createdAt={mention.created_at}
              onPress={() => onPressPost(mention.id)}
            />
          );
        }
        if ("icon" in item) {
          return <ShortcutTile shortcut={item} size={tileSize} />;
        }
        const post = item as ProfilePost;
        return post.post_media.length > 0 ? (
          <MediaTile
            post={post}
            size={tileSize}
            onPress={() => onPressPost(post.id)}
          />
        ) : (
          <TextTile
            post={post}
            size={tileSize}
            onPress={() => onPressPost(post.id)}
          />
        );
      }}
      ListEmptyComponent={
        pending ? (
          <View style={styles.postsState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : errored ? (
          <View style={styles.postsError}>
            <Text style={styles.postsStateText}>Could not load this tab.</Text>
            <Button label="Retry" variant="outline" onPress={() => retry()} />
          </View>
        ) : (
          <View style={styles.postsState}>
            <Ionicons name={emptyCopy.icon} size={34} color={colors.textFaint} />
            <Text style={styles.postsEmptyTitle}>{emptyCopy.text}</Text>
          </View>
        )
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.mutedForeground}
        />
      }
      contentContainerStyle={styles.listContent}
      style={styles.flex}
    />
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: spacing(8),
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tabLabelActive: {
    color: colors.foreground,
  },
  // Short accent underline, the mobile cousin of the web eyebrow labels.
  tabUnderline: {
    width: 16,
    height: 2,
    borderRadius: 1,
    marginTop: spacing(1),
    backgroundColor: "transparent",
  },
  tabUnderlineActive: {
    backgroundColor: colors.primary,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  mediaTile: {
    borderRadius: TILE_RADIUS,
    overflow: "hidden",
  },
  shortcutTile: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: TILE_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(1.5),
  },
  shortcutLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  shortcutCount: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutCountText: {
    color: colors.primaryForeground,
    fontSize: 10,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  tileBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowRadius: 3,
  },
  tileDuration: {
    position: "absolute",
    bottom: 6,
    right: 6,
    color: "#fff",
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: "hidden",
  },
  tilePlaceholder: {
    backgroundColor: colors.surfaceElevated,
  },
  textTile: {
    backgroundColor: colors.surface,
    borderRadius: TILE_RADIUS,
    padding: spacing(2.5),
    justifyContent: "center",
  },
  textTileContent: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  postsState: {
    padding: spacing(8),
    alignItems: "center",
    gap: spacing(2),
  },
  postsError: {
    padding: spacing(8),
    alignItems: "center",
    gap: spacing(3),
  },
  postsStateText: {
    color: colors.mutedForeground,
    fontSize: 13.5,
    textAlign: "center",
  },
  postsEmptyTitle: {
    color: colors.mutedForeground,
    fontSize: 14,
    fontWeight: "600",
  },
});
