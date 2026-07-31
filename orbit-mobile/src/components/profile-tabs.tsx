import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as VideoThumbnails from "expo-video-thumbnails";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { ProfilePostRow } from "@/components/profile-header";
import {
  getUserClips,
  getUserMentions,
  type MentionPost,
  type ProfilePost,
} from "@/lib/queries/profiles";
import { colors, radii, spacing } from "@/lib/theme";

const GRID_GAP = 1;
const GRID_COLUMNS = 3;

type ProfileTab = "posts" | "clips" | "mentions";

const TABS: {
  key: ProfileTab;
  icon: "grid-outline" | "film-outline" | "at-outline";
  label: string;
}[] = [
  { key: "posts", icon: "grid-outline", label: "Posts" },
  { key: "clips", icon: "film-outline", label: "Clips" },
  { key: "mentions", icon: "at-outline", label: "Mentions" },
];

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
            style={[styles.tab, isActive && styles.tabActive]}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={isActive ? colors.foreground : colors.mutedForeground}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

// Storage-hosted videos often have no stored thumbnail; grabbing a frame
// on-device fills the tile. Cached per URL so scrolling never regenerates.
const frameCache = new Map<string, string>();

function useVideoFrame(url: string | null): string | null {
  const [frame, setFrame] = useState<string | null>(
    url ? (frameCache.get(url) ?? null) : null,
  );
  useEffect(() => {
    if (!url || frameCache.has(url)) return;
    let cancelled = false;
    VideoThumbnails.getThumbnailAsync(url, { time: 500 })
      .then(({ uri }) => {
        frameCache.set(url, uri);
        if (!cancelled) setFrame(uri);
      })
      .catch(() => {
        // Tile keeps its dark placeholder; nothing actionable.
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return frame;
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
    </Pressable>
  );
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
}: {
  header: ReactNode;
  posts: ProfilePost[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  userId: string;
  username: string;
  onPressPost: (postId: string) => void;
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
          ? gridData
          : (mentionsQuery.data ?? [])) as (ProfilePost | MentionPost)[]
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
    borderBottomWidth: 1.5,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  tileBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowRadius: 3,
  },
  tilePlaceholder: {
    backgroundColor: colors.surfaceElevated,
  },
  textTile: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
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
