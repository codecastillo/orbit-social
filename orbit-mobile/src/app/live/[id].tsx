import { useCallback, useEffect, useRef, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import * as ScreenOrientation from "expo-screen-orientation";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import { GiftSheet } from "@/components/gift-sheet";
import { useAuth } from "@/providers/auth-provider";
import {
  getRecentChatMessages,
  getStreamById,
  hlsUrl,
  type MuxMaxResolution,
} from "@/lib/queries/live";
import { giftByType, type SentGift } from "@/lib/queries/gifts";
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

// Portrait presents the stream as a full-bleed video canvas with the chat
// and stream info overlaid, so those elements use literal white values
// instead of theme tokens, matching the preview pager in live/index.tsx.
const OVERLAY_TEXT = "#ffffff";
const OVERLAY_TEXT_DIM = "rgba(255, 255, 255, 0.65)";

// Web rose-500, matching the heart tint in stream-content.tsx.
const HEART_COLOR = "#f43f5e";
const HEART_DURATION_MS = 1500;
// Broadcast storms stay cheap: extra hearts past the cap are dropped, not
// queued, so the overlay never floods a small phone screen.
const MAX_CONCURRENT_HEARTS = 8;
const GIFT_BANNER_MS = 2400;
const MAX_GIFT_BANNERS = 3;

// Chat sends go through the web API so its checks (followers-only, slow
// mode, live status) apply to mobile too. The native client has no auth
// cookies, so the session access token rides in the Authorization header.
const CHAT_API_BASE = "https://orbitsocial.net";

const QUALITY_OPTIONS: { value: MuxMaxResolution; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p" },
];

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

interface FloatingHeart {
  id: string;
  xPct: number;
  yPct: number;
}

// Hermes has no crypto.randomUUID; the id only keys removal and dedupe.
function makeLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Port of the web use-stream-hearts hook (src/lib/hooks/use-stream-hearts.ts)
// minus the like-counter display: same channel name, event, and payload
// shape, plus the increment_stream_likes rpc so mobile hearts count too.
function useStreamHearts(streamId: string | undefined): {
  hearts: FloatingHeart[];
  sendHeart: () => void;
} {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!streamId) return;
    const channel = supabase.channel(`hearts:live:${streamId}`, {
      config: { broadcast: { self: true } },
    });
    channel
      .on("broadcast", { event: "heart" }, ({ payload }) => {
        const heart = payload as FloatingHeart;
        setHearts((h) =>
          h.length >= MAX_CONCURRENT_HEARTS ? h : [...h, heart],
        );
        setTimeout(() => {
          setHearts((h) => h.filter((p) => p.id !== heart.id));
        }, HEART_DURATION_MS);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [streamId]);

  const sendHeart = useCallback(() => {
    if (!streamId || !channelRef.current) return;
    const heart: FloatingHeart = {
      id: makeLocalId(),
      // Same drift zone the web desktop like button uses.
      xPct: 0.6 + Math.random() * 0.3,
      yPct: 0.5 + Math.random() * 0.3,
    };
    channelRef.current.send({
      type: "broadcast",
      event: "heart",
      payload: heart,
    });
    void supabase
      .rpc("increment_stream_likes", { p_stream_id: streamId })
      .then(({ error }) => {
        if (error) console.error("increment_stream_likes failed", error);
      });
  }, [streamId]);

  return { hearts, sendHeart };
}

function FloatingHeartView({ heart }: { heart: FloatingHeart }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: HEART_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: `${heart.xPct * 100}%`,
        top: `${heart.yPct * 100}%`,
        opacity: progress.interpolate({
          inputRange: [0, 0.6, 1],
          outputRange: [1, 1, 0],
        }),
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -140],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.6, 1.2],
            }),
          },
        ],
      }}
    >
      <Ionicons name="heart" size={26} color={HEART_COLOR} />
    </Animated.View>
  );
}

function GiftBannerView({ sent }: { sent: SentGift }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <Animated.View
      style={[
        styles.giftBanner,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <MaterialCommunityIcons
        name={sent.gift.icon}
        size={18}
        color={sent.gift.color}
      />
      <Text style={styles.giftBannerText}>{sent.gift.name}</Text>
    </Animated.View>
  );
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

  const { hearts, sendHeart } = useStreamHearts(id);

  const [giftOpen, setGiftOpen] = useState(false);
  const [activeGifts, setActiveGifts] = useState<SentGift[]>([]);
  const pushGift = useCallback((sent: SentGift) => {
    setActiveGifts((g) => [...g.slice(-(MAX_GIFT_BANNERS - 1)), sent]);
    setTimeout(() => {
      setActiveGifts((g) => g.filter((x) => x.id !== sent.id));
    }, GIFT_BANNER_MS);
  }, []);

  // Gifts persist to stream_gifts; this mirrors the web INSERT subscription
  // in stream-content.tsx (the sender animates locally from the insert
  // response, so own rows are skipped).
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`stream-gifts-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stream_gifts",
          filter: `stream_id=eq.${id}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            sender_id: string;
            gift_type: string;
          };
          if (row.sender_id === user?.id) return;
          const gift = giftByType(row.gift_type);
          if (!gift) return;
          pushGift({
            id: row.id,
            streamId: id,
            userId: row.sender_id,
            gift,
            timestamp: Date.now(),
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user?.id, pushGift]);

  // Messages arrive via the broadcast the chat API emits, including our
  // own sends, so a successful POST needs no local append. Scrollback
  // seeds the list from live_chat_messages so mid-stream joins are not
  // empty; the row id the API puts in the broadcast dedupes the overlap.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`live-chat:${id}`);
    channel
      .on("broadcast", { event: "chat-message" }, ({ payload }) => {
        const msg = payload as ChatMessage;
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id)
            ? prev
            : [...prev.slice(-CHAT_BUFFER), msg],
        );
      })
      .subscribe();

    let cancelled = false;
    getRecentChatMessages(id)
      .then((rows) => {
        if (cancelled) return;
        const history: ChatMessage[] = rows.map((r) => ({
          id: r.id,
          username: r.profiles?.username ?? "user",
          displayName: r.profiles?.display_name ?? "User",
          content: r.content,
        }));
        setMessages((prev) => {
          const seen = new Set(history.map((m) => m.id));
          return [...history, ...prev.filter((m) => !seen.has(m.id))].slice(
            -CHAT_BUFFER,
          );
        });
      })
      .catch(() => {
        // Scrollback is best-effort; live broadcasts still fill the list.
      });

    return () => {
      cancelled = true;
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

  // Changing quality rebuilds the HLS URL with Mux's max_resolution playback
  // modifier; useVideoPlayer keys the native player on its source, so the
  // swap re-creates it. Losing position is fine for live.
  const [quality, setQuality] = useState<MuxMaxResolution>("auto");
  const [qualityOpen, setQualityOpen] = useState(false);

  // The app is portrait-locked in app.json; this screen alone may override
  // that for a fullscreen landscape watch mode.
  const [landscape, setLandscape] = useState(false);
  const toggleOrientation = useCallback(() => {
    const next = !landscape;
    setLandscape(next);
    ScreenOrientation.lockAsync(
      next
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ).catch(() => {
      // Some devices refuse the lock (e.g. rotation disabled); fall back to
      // the layout the device actually shows.
      setLandscape(!next);
    });
  }, [landscape]);

  // Restore the app-wide portrait lock whenever this screen stops being the
  // focused one: back navigation, pushing the streamer's profile, unmount.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setLandscape(false);
        void ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        ).catch(() => {});
      };
    }, []),
  );

  const playbackUrl = stream?.mux_playback_id
    ? hlsUrl(stream.mux_playback_id, quality)
    : null;
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

  // Quality and rotate share one markup in both orientations; only their
  // container differs (absolute over the video in landscape, a row above the
  // stream info in portrait).
  const videoControls =
    playbackUrl && live ? (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stream quality"
          onPress={() => setQualityOpen(true)}
          style={({ pressed }) => [
            styles.videoControlButton,
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={18} color="#fff" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={landscape ? "Exit fullscreen" : "Fullscreen"}
          onPress={toggleOrientation}
          style={({ pressed }) => [
            styles.videoControlButton,
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={8}
        >
          <Ionicons
            name={landscape ? "contract-outline" : "expand-outline"}
            size={18}
            color="#fff"
          />
        </Pressable>
      </>
    ) : null;

  const giftBannerViews = activeGifts.map((sent) => (
    <GiftBannerView key={sent.id} sent={sent} />
  ));

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* The video is the backdrop for the whole screen: portrait cover-fills
          it TikTok-style with chat and controls overlaid, landscape letterboxes
          with contain so nothing is cropped in the dedicated watch mode. */}
      {playbackUrl && live ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit={landscape ? "contain" : "cover"}
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
        style={[styles.back, { top: insets.top + spacing(2) }]}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </Pressable>

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {hearts.map((h) => (
          <FloatingHeartView key={h.id} heart={h} />
        ))}
      </View>

      {live && (
        <View style={[styles.overlayTop, { top: insets.top + spacing(2.5) }]}>
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

      {/* Landscape is a video-only watch mode: chat and stream info stay in
          portrait, the exit control above leaves fullscreen. */}
      {landscape ? (
        <>
          <View pointerEvents="none" style={styles.giftBanners}>
            {giftBannerViews}
          </View>
          {videoControls ? (
            <View
              style={[styles.videoControls, { bottom: insets.bottom + spacing(2) }]}
            >
              {videoControls}
            </View>
          ) : null}
        </>
      ) : (
        <>
          <View style={{ flex: 1 }} pointerEvents="none" />
          <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + spacing(2) }]}>
            <View pointerEvents="none" style={styles.giftBannersPortrait}>
              {giftBannerViews}
            </View>
            {videoControls ? (
              <View style={styles.videoControlsPortrait}>{videoControls}</View>
            ) : null}
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Send a gift"
                    onPress={() => setGiftOpen(true)}
                    style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="gift-outline" size={20} color={colors.foreground} />
                  </Pressable>
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Send a heart"
                    onPress={sendHeart}
                    style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="heart" size={20} color={HEART_COLOR} />
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </>
      )}
      {user && id ? (
        <GiftSheet
          visible={giftOpen}
          streamId={id}
          onClose={() => setGiftOpen(false)}
          onSent={pushGift}
        />
      ) : null}
      <QualitySheet
        visible={qualityOpen}
        quality={quality}
        onSelect={(next) => {
          setQuality(next);
          setQualityOpen(false);
        }}
        onClose={() => setQualityOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

function QualitySheet({
  visible,
  quality,
  onSelect,
  onClose,
}: {
  visible: boolean;
  quality: MuxMaxResolution;
  onSelect: (next: MuxMaxResolution) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.qualityBackdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close quality settings"
      >
        <View
          style={[
            styles.qualityPanel,
            { marginBottom: insets.bottom + spacing(6) },
          ]}
        >
          <Text style={styles.qualityHeading}>Quality</Text>
          {QUALITY_OPTIONS.map((option) => {
            const selected = option.value === quality;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelect(option.value)}
                style={({ pressed }) => [
                  styles.qualityRow,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.qualityLabel,
                    selected && { color: colors.primary },
                  ]}
                >
                  {option.label}
                </Text>
                {selected ? (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  bottomOverlay: {
    backgroundColor: "transparent",
  },
  videoControls: {
    position: "absolute",
    right: spacing(3),
    flexDirection: "row",
    gap: spacing(2),
  },
  videoControlsPortrait: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing(2),
    paddingHorizontal: spacing(3),
    paddingBottom: spacing(2),
  },
  videoControlButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  qualityBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  qualityPanel: {
    marginHorizontal: spacing(4),
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: spacing(2),
  },
  qualityHeading: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  qualityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  qualityLabel: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
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
    color: OVERLAY_TEXT,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  host: {
    color: OVERLAY_TEXT_DIM,
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
    color: OVERLAY_TEXT_DIM,
    fontSize: 13,
    lineHeight: 19,
  },
  chatName: {
    color: OVERLAY_TEXT,
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
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  giftBanners: {
    position: "absolute",
    left: spacing(3),
    bottom: spacing(3),
    gap: spacing(1.5),
  },
  // Portrait stacks the banners in the bottom overlay's normal flow instead
  // of pinning them, so they sit above the controls rather than over them.
  giftBannersPortrait: {
    alignItems: "flex-start",
    gap: spacing(1.5),
    paddingHorizontal: spacing(3),
    paddingBottom: spacing(1.5),
  },
  giftBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radii.full,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
  },
  giftBannerText: {
    color: "#fff",
    fontSize: 12.5,
    fontWeight: "700",
  },
});
