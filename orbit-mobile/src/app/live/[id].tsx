import { useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import { getStreamById, hlsUrl } from "@/lib/queries/live";
import { supabase } from "@/lib/supabase";
import { safeBack } from "@/lib/nav";
import { formatNumber } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";

interface ChatMessage {
  id: string;
  username: string;
  displayName: string;
  content: string;
}

const CHAT_BUFFER = 60;

export default function LiveViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const {
    data: stream,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["live-stream", id],
    queryFn: () => getStreamById(id),
    refetchInterval: 30_000,
  });

  // Chat is read-only for now: the web's send path authenticates via
  // cookies, which the native client does not carry.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`live-chat:${id}`);
    channel
      .on("broadcast", { event: "chat-message" }, ({ payload }) => {
        const msg = payload as ChatMessage;
        setMessages((prev) => [...prev.slice(-CHAT_BUFFER), msg]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const playbackUrl = stream?.mux_playback_id ? hlsUrl(stream.mux_playback_id) : null;
  const player = useVideoPlayer(playbackUrl, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (isFocused && playbackUrl) player.play();
    else player.pause();
  }, [isFocused, playbackUrl, player]);

  if (isPending) {
    return (
      <Centered>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.primary} />
      </Centered>
    );
  }

  if (isError || !stream) {
    return (
      <>
        <Stack.Screen options={{ title: "Live" }} />
        <EmptyState
          title={isError ? "Stream did not load" : "Stream not found"}
          description={isError ? "Check your connection and try again." : "It may have ended."}
          action={
            isError ? (
              <Button label="Retry" variant="outline" onPress={() => refetch()} />
            ) : undefined
          }
        />
      </>
    );
  }

  const live = stream.status === "live";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.videoWrap}>
        {playbackUrl && live ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            nativeControls={false}
          />
        ) : (
          <View style={styles.offline}>
            <Ionicons name="videocam-off-outline" size={32} color={colors.mutedForeground} />
            <Text style={styles.offlineText}>
              {stream.status === "ended" ? "This stream has ended." : "Stream is starting soon."}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => safeBack(router)}
          style={[styles.back, { top: spacing(2) }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>

        {live && (
          <View style={styles.overlayTop}>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
            <View style={styles.viewers}>
              <Ionicons name="eye-outline" size={13} color="#fff" />
              <Text style={styles.viewersText}>{formatNumber(stream.viewer_count)}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Avatar
          url={stream.profiles.avatar_url}
          name={stream.profiles.display_name}
          size={40}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>
            {stream.title}
          </Text>
          <Pressable
            onPress={() => router.push(`/user/${stream.profiles.username}` as never)}
          >
            <Text style={styles.host}>{stream.profiles.display_name}</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={[...messages].reverse()}
        inverted
        keyExtractor={(m) => m.id}
        style={styles.chat}
        contentContainerStyle={{ padding: spacing(3), gap: spacing(1.5) }}
        ListEmptyComponent={
          <Text style={styles.chatEmpty}>Chat appears here as people talk.</Text>
        }
        renderItem={({ item }) => (
          <Text style={styles.chatLine} numberOfLines={3}>
            <Text style={styles.chatName}>{item.displayName} </Text>
            {item.content}
          </Text>
        )}
      />
      <View style={{ height: insets.bottom }} />
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
  offline: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2),
  },
  offlineText: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  back: {
    position: "absolute",
    left: spacing(2),
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayTop: {
    position: "absolute",
    top: spacing(2.5),
    right: spacing(3),
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
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
  viewers: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  viewersText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    padding: spacing(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  host: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 2,
  },
  chat: {
    flex: 1,
  },
  chatEmpty: {
    color: colors.textFaint,
    fontSize: 13,
    textAlign: "center",
    transform: [{ scaleY: -1 }],
  },
  chatLine: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  chatName: {
    color: colors.foreground,
    fontWeight: "600",
  },
});
