import { useEffect, useRef } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import { hlsUrl } from "@/lib/queries/live";
import { getVodById, incrementVodViews } from "@/lib/queries/vods";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";

// Plays a finished stream recording. Web plays these through MuxPlayer with
// the same playback id; expo-video takes the equivalent HLS URL directly.
export default function VodScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isFocused = useIsFocused();
  const incrementedRef = useRef(false);

  const {
    data: vod,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["vod", id],
    queryFn: () => getVodById(id),
  });

  // Count the view once per screen visit, same as the web VOD page.
  useEffect(() => {
    if (!vod || incrementedRef.current) return;
    incrementedRef.current = true;
    incrementVodViews(vod.id).catch(() => {
      incrementedRef.current = false;
    });
  }, [vod]);

  const playbackUrl = vod ? hlsUrl(vod.mux_playback_id) : null;
  const player = useVideoPlayer(playbackUrl, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (!isFocused) player.pause();
  }, [isFocused, player]);

  if (isPending) {
    return (
      <Centered>
        <Stack.Screen options={{ title: "Past stream" }} />
        <ActivityIndicator color={colors.primary} />
      </Centered>
    );
  }

  if (isError || !vod) {
    return (
      <>
        <Stack.Screen options={{ title: "Past stream" }} />
        <EmptyState
          title={isError ? "Recording did not load" : "Recording not found"}
          description={
            isError
              ? "Check your connection and try again."
              : "It may have been deleted."
          }
          action={
            isError ? (
              <Button label="Retry" variant="outline" onPress={() => refetch()} />
            ) : undefined
          }
        />
      </>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Past stream" }} />

      <View style={styles.videoWrap}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls
        />
      </View>

      <View style={styles.info}>
        {vod.title ? <Text style={styles.title}>{vod.title}</Text> : null}
        <Text style={styles.meta}>
          {formatNumber(vod.view_count)} views  ·  {formatTimeAgo(vod.created_at)}
          {vod.category ? `  ·  ${vod.category}` : ""}
        </Text>
      </View>

      {vod.profile ? (
        <Pressable
          onPress={() => router.push(`/user/${vod.profile!.username}` as never)}
          style={({ pressed }) => [styles.streamer, pressed && { opacity: 0.7 }]}
        >
          <Avatar
            url={vod.profile.avatar_url}
            name={vod.profile.display_name}
            size={40}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.streamerName} numberOfLines={1}>
              {vod.profile.display_name}
            </Text>
            <Text style={styles.streamerHandle} numberOfLines={1}>
              @{vod.profile.username}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.mutedForeground}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  videoWrap: {
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
  },
  info: {
    padding: spacing(4),
    gap: spacing(1),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  meta: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  streamer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    padding: spacing(4),
  },
  streamerName: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  streamerHandle: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 2,
  },
});
