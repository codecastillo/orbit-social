import { useCallback, useEffect, useState } from "react";
import { useRouter, Stack } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEventListener } from "expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { VideoView, useVideoPlayer } from "expo-video";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import { getLiveStreams, hlsUrl, type LiveStreamWithProfile } from "@/lib/queries/live";
import { safeBack } from "@/lib/nav";
import { formatNumber } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";

// The pager is an always-dark video canvas like clips-feed, so its overlay
// uses literal white/scrim values instead of theme tokens.
const OVERLAY_TEXT = "#ffffff";
const OVERLAY_TEXT_DIM = "rgba(255, 255, 255, 0.65)";

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

// One full-screen muted preview page. Deliberately touches nothing realtime:
// no presence, chat, hearts, or gift channels and no view RPCs, so browsing
// past a stream never counts anyone as a viewer. Only the full viewer
// (live/[id].tsx) joins presence and shows up in viewer_count.
function StreamPreviewPage({
  stream,
  height,
  isActive,
  onWatch,
  onOpenProfile,
}: {
  stream: LiveStreamWithProfile;
  height: number;
  isActive: boolean;
  onWatch: () => void;
  onOpenProfile: () => void;
}) {
  const insets = useSafeAreaInsets();
  const playbackUrl = stream.mux_playback_id ? hlsUrl(stream.mux_playback_id) : null;
  const player = useVideoPlayer(playbackUrl, (p) => {
    p.loop = false;
    p.muted = true;
  });

  // Most broadcasts come from OBS in landscape; cover-filling those into a
  // portrait page leaves a center-cropped sliver. Once the track reports its
  // size, landscape sources render as a full-width band centered vertically
  // instead. Portrait (and unknown) sources keep the full-bleed cover fill.
  const [sourceAspect, setSourceAspect] = useState<number | null>(null);
  useEventListener(player, "videoTrackChange", ({ videoTrack }) => {
    const size = videoTrack?.size;
    if (size && size.width > 0 && size.height > 0) {
      setSourceAspect(size.width / size.height);
    }
  });
  const isLandscapeSource = sourceAspect !== null && sourceAspect > 1;

  useEffect(() => {
    if (isActive && playbackUrl) player.play();
    else player.pause();
  }, [isActive, playbackUrl, player]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Watch ${stream.profiles.display_name} live`}
      onPress={onWatch}
      style={[styles.page, { height }]}
    >
      {playbackUrl ? (
        <View style={styles.videoCenter}>
          <VideoView
            player={player}
            style={
              isLandscapeSource && sourceAspect
                ? { width: "100%", aspectRatio: sourceAspect }
                : StyleSheet.absoluteFill
            }
            contentFit="cover"
            nativeControls={false}
          />
        </View>
      ) : (
        <Centered>
          <Ionicons name="videocam-outline" size={32} color={OVERLAY_TEXT_DIM} />
        </Centered>
      )}

      {/* Sits just below the floating pager header row. */}
      <View
        style={[styles.pageTopRight, { top: insets.top + spacing(14) }]}
        pointerEvents="none"
      >
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
        <View style={styles.viewersPill}>
          <Ionicons name="eye-outline" size={13} color={OVERLAY_TEXT} />
          <Text style={styles.viewersPillText}>
            {formatNumber(stream.viewer_count)}
          </Text>
        </View>
      </View>

      <View style={[styles.pageOverlay, { paddingBottom: insets.bottom + spacing(6) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${stream.profiles.display_name}'s profile`}
          onPress={onOpenProfile}
          style={({ pressed }) => [styles.streamerRow, pressed && { opacity: 0.8 }]}
        >
          <Avatar
            url={stream.profiles.avatar_url}
            name={stream.profiles.display_name}
            size={38}
          />
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text style={styles.streamerName} numberOfLines={1}>
              {stream.profiles.display_name}
            </Text>
            <Text style={styles.streamerHandle} numberOfLines={1}>
              @{stream.profiles.username}
            </Text>
          </View>
        </Pressable>
        <Text style={styles.streamTitle} numberOfLines={2}>
          {stream.title}
        </Text>
        {stream.category ? (
          <Text style={styles.streamCategory} numberOfLines={1}>
            {stream.category}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function LiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [pageHeight, setPageHeight] = useState(0);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const {
    data: streams,
    isPending,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["live-streams"],
    queryFn: getLiveStreams,
    refetchInterval: 30_000,
  });

  const hasLive = !!streams && streams.length > 0;

  // FlatList requires a referentially stable handler; empty deps keep it so.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visible = viewableItems.find((v) => v.isViewable);
      if (visible?.item) {
        setActiveStreamId((visible.item as LiveStreamWithProfile).id);
      }
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: LiveStreamWithProfile }) => (
      <StreamPreviewPage
        stream={item}
        height={pageHeight}
        isActive={isFocused && item.id === activeStreamId}
        onWatch={() => router.push(`/live/${item.id}` as never)}
        onOpenProfile={() => router.push(`/user/${item.profiles.username}` as never)}
      />
    ),
    [pageHeight, isFocused, activeStreamId, router],
  );

  if (hasLive) {
    return (
      <View
        style={styles.pagerRoot}
        onLayout={(e) => {
          const { height } = e.nativeEvent.layout;
          if (height > 0) setPageHeight(height);
        }}
      >
        <Stack.Screen options={{ headerShown: false }} />
        {pageHeight > 0 ? (
          <FlatList
            data={streams}
            keyExtractor={(s) => s.id}
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
            windowSize={3}
          />
        ) : null}

        <View style={[styles.pagerHeader, { top: insets.top + spacing(2) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => safeBack(router)}
            style={styles.headerIconButton}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={OVERLAY_TEXT} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Live" }} />
      {isPending ? (
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      ) : isError ? (
        <EmptyState
          title="Live did not load"
          description="Check your connection and try again."
          action={<Button label="Retry" variant="outline" onPress={() => refetch()} />}
        />
      ) : (
        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={styles.emptyWrap}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        >
          <Ionicons name="videocam-outline" size={40} color={colors.mutedForeground} />
          <EmptyState
            title="Nobody is live right now"
            description="Streams from people you follow show up here the moment they go on air. To start your own, head to Settings > Streaming."
          />
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  pagerRoot: {
    flex: 1,
    backgroundColor: "#000",
  },
  page: {
    width: "100%",
    backgroundColor: "#000",
  },
  videoCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
  },
  pagerHeader: {
    position: "absolute",
    left: spacing(3),
    right: spacing(3),
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  pageTopRight: {
    position: "absolute",
    right: spacing(3),
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
  },
  viewersPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  viewersPillText: {
    color: OVERLAY_TEXT,
    fontSize: 12,
    fontWeight: "600",
  },
  pageOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing(4),
    gap: spacing(2),
    backgroundColor: "transparent",
  },
  streamerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
  },
  streamerName: {
    color: OVERLAY_TEXT,
    fontSize: 14.5,
    fontWeight: "600",
  },
  streamerHandle: {
    color: OVERLAY_TEXT_DIM,
    fontSize: 12.5,
  },
  streamTitle: {
    color: OVERLAY_TEXT,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  streamCategory: {
    color: OVERLAY_TEXT_DIM,
    fontSize: 13,
  },
  liveBadge: {
    backgroundColor: colors.destructive,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  emptyWrap: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(6),
  },
});
