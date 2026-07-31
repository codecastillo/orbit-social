import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VideoView, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import {
  CLIP_PAGE_SIZE,
  getClips,
  toggleClipLike,
  type ClipWithAuthor,
} from "@/lib/queries/clips";
import { formatNumber } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { colors, spacing } from "@/lib/theme";

// The clips surface is an always-dark video canvas, so the overlay uses
// literal white/scrim values instead of theme tokens.
const OVERLAY_TEXT = "#ffffff";
const OVERLAY_SCRIM = "rgba(0, 0, 0, 0.35)";

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

function ClipItem({
  clip,
  height,
  isActive,
  userId,
}: {
  clip: ClipWithAuthor;
  height: number;
  isActive: boolean;
  userId: string;
}) {
  const insets = useSafeAreaInsets();
  const video =
    clip.post_media.find((m) => m.type === "video") ?? clip.post_media[0];

  const player = useVideoPlayer(video?.url ?? null, (p) => {
    p.loop = true;
  });
  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState(clip.user_has_liked);
  const [likeCount, setLikeCount] = useState(clip.like_count);

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  useEffect(() => {
    // Assigning player properties is expo-video's documented API; the
    // immutability rule cannot know the hook hands back a mutable native
    // object, so this one line opts out.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
  }, [muted, player]);

  const likeMutation = useMutation({
    mutationFn: (wasLiked: boolean) => toggleClipLike(userId, clip.id, wasLiked),
    onError: (_err, wasLiked) => {
      // Roll the optimistic flip back.
      setLiked(wasLiked);
      setLikeCount((n) => (wasLiked ? n + 1 : n - 1));
    },
  });

  const handleLike = () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((n) => (wasLiked ? n - 1 : n + 1));
    likeMutation.mutate(wasLiked);
  };

  const handleToggleMute = () => {
    setMuted((m) => !m);
  };

  const authorName = clip.profiles.display_name || clip.profiles.username;

  return (
    <View style={[styles.page, { height }]}>
      {video ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={muted ? "Unmute clip" : "Mute clip"}
          style={StyleSheet.absoluteFill}
          onPress={handleToggleMute}
        >
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
        </Pressable>
      ) : (
        <Centered>
          <Text style={{ color: colors.mutedForeground }}>
            This clip has no video.
          </Text>
        </Centered>
      )}

      {muted ? (
        <View style={[styles.muteBadge, { top: insets.top + spacing(3) }]}>
          <Ionicons name="volume-mute" size={16} color={OVERLAY_TEXT} />
        </View>
      ) : null}

      <View style={[styles.overlay, { paddingBottom: spacing(4) }]}>
        <View style={styles.meta}>
          <View style={styles.authorRow}>
            <Avatar url={clip.profiles.avatar_url} name={authorName} size={34} />
            <Text style={styles.authorName} numberOfLines={1}>
              {authorName}
            </Text>
          </View>
          {clip.content ? (
            <Text style={styles.caption} numberOfLines={3}>
              {clip.content}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={liked ? "Unlike clip" : "Like clip"}
            onPress={handleLike}
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={30}
              color={liked ? colors.destructive : OVERLAY_TEXT}
            />
            <Text style={styles.actionCount}>{formatNumber(likeCount)}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function ClipsScreen() {
  const { user } = useAuth();
  const [pageHeight, setPageHeight] = useState(0);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["clips", user?.id],
    queryFn: ({ pageParam }) => getClips(user!.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length < CLIP_PAGE_SIZE
        ? undefined
        : lastPage[lastPage.length - 1]?.created_at,
    enabled: !!user,
  });

  const clips = data?.pages.flat() ?? [];

  // FlatList requires a referentially stable handler; empty deps keep it so.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visible = viewableItems.find((v) => v.isViewable);
      if (visible?.item) {
        setActiveClipId((visible.item as ClipWithAuthor).id);
      }
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: ClipWithAuthor }) => (
      <ClipItem
        clip={item}
        height={pageHeight}
        isActive={item.id === activeClipId}
        userId={user?.id ?? ""}
      />
    ),
    [pageHeight, activeClipId, user?.id],
  );

  if (!user) return null;

  return (
    <View
      style={styles.container}
      onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
    >
      {isPending || pageHeight === 0 ? (
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      ) : isError ? (
        <EmptyState
          title="Clips did not load"
          description="Check your connection and try again."
          action={<Button label="Retry" variant="outline" onPress={() => refetch()} />}
        />
      ) : clips.length === 0 ? (
        <EmptyState
          title="No clips yet"
          description="When people you follow post clips, they show up here."
        />
      ) : (
        <FlatList
          data={clips}
          keyExtractor={(clip) => clip.id}
          renderItem={renderItem}
          pagingEnabled
          snapToInterval={pageHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: pageHeight,
            offset: pageHeight * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={2}
          windowSize={3}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  page: {
    width: "100%",
    backgroundColor: "#000",
  },
  muteBadge: {
    position: "absolute",
    right: spacing(4),
    backgroundColor: OVERLAY_SCRIM,
    borderRadius: 999,
    padding: spacing(2),
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing(4),
  },
  meta: {
    flex: 1,
    marginRight: spacing(4),
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
  },
  authorName: {
    color: OVERLAY_TEXT,
    fontSize: 14.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  caption: {
    color: OVERLAY_TEXT,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: spacing(2),
  },
  actions: {
    alignItems: "center",
  },
  actionButton: {
    alignItems: "center",
  },
  actionCount: {
    color: OVERLAY_TEXT,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
});
