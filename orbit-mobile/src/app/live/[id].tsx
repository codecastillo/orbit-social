import { useCallback, useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { getStreamById, hlsUrl } from "@/lib/queries/live";
import { supabase } from "@/lib/supabase";
import { safeBack } from "@/lib/nav";
import { formatNumber } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

interface ChatMessage {
  id: string;
  username: string;
  displayName: string;
  content: string;
}

const CHAT_BUFFER = 60;
const CHAT_MAX_LENGTH = 500;

// Chat sends go through the web API so its checks (followers-only, slow
// mode, live status) apply to mobile too. The native client has no auth
// cookies, so the session access token rides in the Authorization header.
const CHAT_API_BASE = "https://orbitsocial.net";

// Minimal port of the web use-stream-presence hook: join the same presence
// channel so mobile viewers show up in viewer_count, and read the live
// headcount back. The streamer's web session owns the viewer_count write.
function useViewerPresence(
  streamId: string | undefined,
  userId: string | null,
  isStreamer: boolean,
): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!streamId) return;
    // Random fallback lives inside the effect so it stays stable for the
    // life of one subscription without tripping render purity.
    const presenceKey = userId ?? `anon-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(`presence:live:${streamId}`, {
      config: { presence: { key: presenceKey } },
    });

    const sync = () => setCount(Object.keys(channel.presenceState()).length);

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !isStreamer) {
          await channel.track({ joined_at: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, userId, isStreamer]);

  return count;
}

export default function LiveViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { user } = useAuth();

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

  const isStreamer = !!user && stream?.user_id === user.id;
  const presenceCount = useViewerPresence(id, user?.id ?? null, isStreamer);

  // Messages arrive via the broadcast the chat API emits, including our
  // own sends, so a successful POST needs no local append.
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

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const sendChat = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setChatError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setChatError("Sign in to chat.");
        return;
      }
      const res = await fetch(`${CHAT_API_BASE}/api/live/${id}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setDraft("");
        return;
      }
      let body: { error?: string; retry_after?: number } = {};
      try {
        body = (await res.json()) as { error?: string; retry_after?: number };
      } catch {}
      if (res.status === 403 && body.error === "followers_only") {
        setChatError("Only followers can chat in this stream");
      } else if (res.status === 429 && body.error === "slow_mode") {
        setChatError(`Slow mode, wait ${body.retry_after ?? 0}s`);
      } else if (res.status === 410 && body.error === "stream_not_live") {
        setChatError("Stream isn't live");
      } else {
        setChatError("Couldn't send");
      }
    } catch {
      setChatError("Couldn't send");
    } finally {
      setSending(false);
    }
  }, [draft, sending, id]);

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
  const canSend = draft.trim().length > 0 && !sending;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
              <Text style={styles.viewersText}>
                {formatNumber(presenceCount > 0 ? presenceCount : stream.viewer_count)}
              </Text>
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
      {live && user ? (
        <>
          {chatError ? <Text style={styles.chatErrorText}>{chatError}</Text> : null}
          <View style={styles.composer}>
            <TextInput
              style={styles.composerInput}
              placeholder="Say something"
              placeholderTextColor={colors.textFaint}
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                if (chatError) setChatError(null);
              }}
              maxLength={CHAT_MAX_LENGTH}
              multiline
              accessibilityLabel="Chat message"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send chat message"
              onPress={() => void sendChat()}
              disabled={!canSend}
              style={({ pressed }) => [
                styles.sendButton,
                !canSend && { opacity: 0.4 },
                pressed && { opacity: 0.7 },
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Ionicons name="arrow-up" size={20} color={colors.primaryForeground} />
              )}
            </Pressable>
          </View>
        </>
      ) : null}
      <View style={{ height: insets.bottom }} />
    </KeyboardAvoidingView>
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
  chatErrorText: {
    color: colors.destructive,
    fontSize: 12,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(1.5),
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing(2),
    paddingHorizontal: spacing(3),
    paddingTop: spacing(2),
    paddingBottom: spacing(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 90,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    color: colors.foreground,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    fontSize: 14.5,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
