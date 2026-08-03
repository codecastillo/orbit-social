import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Centered, EmptyState } from "@/components/ui";
import { StoryOverlayLayer } from "@/components/story-overlays";
import { StoryViewersSheet } from "@/components/story-viewers-sheet";
import {
  getActiveStories,
  markStoryViewed,
  sendStoryReaction,
  type StoryWithAuthor,
} from "@/lib/queries/stories";
import { getHighlights } from "@/lib/queries/highlights";
import { EmojiPickerSheet } from "@/components/emoji-picker-sheet";
import { REACTION_QUICK_ROW } from "@/lib/reactions";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const DEFAULT_IMAGE_DURATION_SECONDS = 5;

// The story viewer is an always-dark media canvas, so the chrome uses
// literal white/track values instead of theme tokens.
const CHROME_TEXT = "#ffffff";
const PROGRESS_TRACK = "rgba(255, 255, 255, 0.2)";

function StoryVideo({ story }: { story: StoryWithAuthor }) {
  const player = useVideoPlayer(story.media_url, (p) => {
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

export default function StoryViewerScreen() {
  const params = useLocalSearchParams<{ userId: string; highlight?: string }>();
  const authorId = typeof params.userId === "string" ? params.userId : "";
  // With a highlight id the screen plays that explicit story list instead
  // of the author's active stories, so highlights outlive the 24h window.
  const highlightId =
    typeof params.highlight === "string" ? params.highlight : null;
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  // Lazy useState instead of useRef so reading the value in render does
  // not trip the react-hooks/refs rule.
  const [progress] = useState(() => new Animated.Value(0));
  const [reactionState, setReactionState] = useState<
    "idle" | "sending" | "sent" | "failed"
  >("idle");
  const [viewersOpen, setViewersOpen] = useState(false);
  const [emojiSheetOpen, setEmojiSheetOpen] = useState(false);
  // Dual-capture moments only: true when the selfie has been tapped big,
  // putting the back photo in the corner PiP instead. Reset per story.
  const [selfieSwapped, setSelfieSwapped] = useState(false);
  const reactionResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeQuery = useQuery({
    queryKey: ["stories", user?.id],
    queryFn: () => getActiveStories(user!.id),
    enabled: !!user && !highlightId,
  });

  // Shares the cache key the profile highlights row populates.
  const highlightsQuery = useQuery({
    queryKey: ["story-highlights", authorId],
    queryFn: () => getHighlights(authorId),
    enabled: !!user && !!highlightId,
  });

  const { isPending, isError, refetch } = highlightId
    ? highlightsQuery
    : activeQuery;

  const group = highlightId
    ? undefined
    : activeQuery.data?.find((g) => g.user.id === authorId);
  const highlight = highlightId
    ? highlightsQuery.data?.find((h) => h.id === highlightId)
    : undefined;
  const stories = highlightId ? (highlight?.stories ?? []) : (group?.stories ?? []);
  const current = stories[index];

  const goNext = () => {
    if (index + 1 < stories.length) {
      setReactionState("idle");
      setSelfieSwapped(false);
      setIndex(index + 1);
    } else {
      router.back();
    }
  };

  const goPrev = () => {
    if (index > 0) {
      setReactionState("idle");
      setSelfieSwapped(false);
      setIndex(index - 1);
    }
  };

  const react = async (story: StoryWithAuthor, emoji: string) => {
    if (!user || reactionState === "sending") return;
    setReactionState("sending");
    if (reactionResetRef.current) clearTimeout(reactionResetRef.current);
    try {
      await sendStoryReaction(story, user.id, emoji);
      setReactionState("sent");
    } catch {
      setReactionState("failed");
    }
    reactionResetRef.current = setTimeout(() => setReactionState("idle"), 1800);
  };

  useEffect(() => {
    return () => {
      if (reactionResetRef.current) clearTimeout(reactionResetRef.current);
    };
  }, []);

  // Auto-advance images on a timer; video stories advance by tap only in
  // v1, so their bar stays empty while they play. Paused while the viewers
  // sheet or emoji picker is up so the story cannot advance out from
  // under it.
  useEffect(() => {
    if (!current || viewersOpen || emojiSheetOpen) return;
    progress.setValue(0);
    if (current.media_type !== "image") return;

    const durationMs =
      (current.duration_seconds || DEFAULT_IMAGE_DURATION_SECONDS) * 1000;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) goNext();
    });
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, viewersOpen, emojiSheetOpen]);

  useEffect(() => {
    if (!user || !current) return;
    markStoryViewed(current.id, user.id).catch(() => {
      // A missed view record is not worth interrupting playback for.
    });
  }, [user, current?.id, current]);

  // Refresh the ring highlights once the viewer closes.
  useEffect(() => {
    return () => {
      queryClient.invalidateQueries({ queryKey: ["stories", user?.id] });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  const author = highlightId ? highlight?.stories[0]?.profiles : group?.user;
  const authorName = author ? author.display_name || author.username : "";

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, animation: "fade" }} />

      {isPending ? (
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      ) : isError ? (
        <EmptyState
          title="Moments did not load"
          description="Check your connection and try again."
          action={<Button label="Retry" variant="outline" onPress={() => refetch()} />}
        />
      ) : !current ? (
        <EmptyState
          title="Moment unavailable"
          description="These moments may have expired."
          action={<Button label="Close" variant="outline" onPress={() => router.back()} />}
        />
      ) : (
        <>
          {current.media_type === "video" ? (
            <StoryVideo key={current.id} story={current} />
          ) : (
            <Image
              source={{
                uri:
                  selfieSwapped && current.interactive_data?.selfie
                    ? current.interactive_data.selfie.url
                    : current.media_url,
              }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              transition={100}
              alt={`Moment from ${authorName}`}
            />
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous moment"
            style={styles.prevZone}
            onPress={goPrev}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next moment"
            style={styles.nextZone}
            onPress={goNext}
          />

          {/* Rendered after the tap zones so the sticker chips win the touch.
              A dual-capture selfie renders as a tappable PiP; tapping swaps
              which photo is big, so the PiP always shows the small one. */}
          <StoryOverlayLayer
            textOverlay={current.text_overlay}
            stickers={current.interactive_data?.stickers ?? []}
            selfie={
              current.interactive_data?.selfie
                ? {
                    ...current.interactive_data.selfie,
                    url: selfieSwapped
                      ? current.media_url
                      : current.interactive_data.selfie.url,
                  }
                : null
            }
            onSelfiePress={
              current.interactive_data?.selfie
                ? () => setSelfieSwapped((s) => !s)
                : undefined
            }
            onMentionPress={(username) => router.push(`/user/${username}`)}
            onLinkPress={(url) => {
              Linking.openURL(url).catch(() => {
                // Malformed sticker URL; nothing actionable.
              });
            }}
          />

          {/* Own stories swap the reaction bar for the viewer count, which
              opens the viewers sheet. */}
          {current.user_id === user.id ? (
            <View
              style={[styles.reactionBar, { bottom: insets.bottom + spacing(4) }]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="See who viewed your moment"
                onPress={() => setViewersOpen(true)}
                style={({ pressed }) => [
                  styles.viewersButton,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="eye-outline" size={16} color={CHROME_TEXT} />
                <Text style={styles.viewersCount}>
                  {formatNumber(current.view_count)}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* Quick reactions, other people's stories only. Sends a DM to
              the author and a story_reaction notification. */}
          {current.user_id !== user.id ? (
            <View
              style={[styles.reactionBar, { bottom: insets.bottom + spacing(4) }]}
            >
              {reactionState === "sent" || reactionState === "failed" ? (
                <View style={styles.reactionRow}>
                  <Text style={styles.reactionStatus}>
                    {reactionState === "sent"
                      ? "Reaction sent"
                      : "Couldn't send reaction"}
                  </Text>
                </View>
              ) : (
                <View style={styles.reactionRow}>
                  {REACTION_QUICK_ROW.map(({ emoji, label }) => (
                    <Pressable
                      key={emoji}
                      accessibilityRole="button"
                      accessibilityLabel={`React with ${label}`}
                      disabled={reactionState === "sending"}
                      onPress={() => react(current, emoji)}
                      style={({ pressed }) => [
                        styles.reactionButton,
                        (pressed || reactionState === "sending") && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={styles.reactionGlyph}>{emoji}</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="React with any emoji"
                    disabled={reactionState === "sending"}
                    onPress={() => setEmojiSheetOpen(true)}
                    style={({ pressed }) => [
                      styles.reactionButton,
                      (pressed || reactionState === "sending") && { opacity: 0.6 },
                    ]}
                  >
                    <Ionicons name="add" size={22} color={CHROME_TEXT} />
                  </Pressable>
                </View>
              )}
            </View>
          ) : null}

          <View style={[styles.chrome, { top: insets.top + spacing(2) }]}>
            <View style={styles.progressRow}>
              {stories.map((story, i) => (
                <View key={story.id} style={styles.progressTrack}>
                  {i < index ? (
                    <View style={styles.progressFillFull} />
                  ) : i === index ? (
                    <Animated.View
                      style={[
                        styles.progressFill,
                        {
                          width: progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0%", "100%"],
                          }),
                        },
                      ]}
                    />
                  ) : null}
                </View>
              ))}
            </View>

            <View style={styles.headerRow}>
              {/* Orbit satellite-dot, the brand mark's orbiting dot */}
              <View style={styles.headerDot} />
              <Text style={styles.author} numberOfLines={1}>
                {authorName}
              </Text>
              <Text style={styles.time}>{formatTimeAgo(current.created_at)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close moments"
                onPress={() => router.back()}
                hitSlop={10}
                style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="close" size={26} color={CHROME_TEXT} />
              </Pressable>
            </View>
          </View>

          <StoryViewersSheet
            visible={viewersOpen}
            onClose={() => setViewersOpen(false)}
            storyId={current.id}
          />

          {emojiSheetOpen ? (
            <EmojiPickerSheet
              visible
              onSelect={(emoji) => {
                setEmojiSheetOpen(false);
                void react(current, emoji);
              }}
              onClose={() => setEmojiSheetOpen(false)}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  prevZone: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "30%",
  },
  nextZone: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "70%",
  },
  chrome: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: spacing(3),
  },
  // Dot-dash chrome: short rounded segments with real gaps and a violet
  // fill instead of the usual continuous white hairline.
  progressRow: {
    flexDirection: "row",
    gap: spacing(1.5),
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: PROGRESS_TRACK,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  progressFillFull: {
    height: "100%",
    width: "100%",
    backgroundColor: colors.primary,
  },
  headerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    marginTop: spacing(3),
  },
  author: {
    color: CHROME_TEXT,
    fontSize: 14.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  time: {
    color: PROGRESS_TRACK,
    fontSize: 12.5,
    flex: 1,
  },
  closeButton: {
    padding: spacing(1),
  },
  reactionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  reactionRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    borderRadius: radii.full,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: spacing(2),
  },
  reactionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionGlyph: {
    fontSize: 22,
  },
  reactionStatus: {
    color: CHROME_TEXT,
    fontSize: 13.5,
    fontWeight: "600",
    paddingHorizontal: spacing(3),
  },
  viewersButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    minHeight: 36,
    borderRadius: radii.full,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: spacing(3.5),
  },
  viewersCount: {
    color: CHROME_TEXT,
    fontSize: 13.5,
    fontWeight: "600",
  },
});
