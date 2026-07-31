import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import {
  getActiveStories,
  markStoryViewed,
  type StoryWithAuthor,
} from "@/lib/queries/stories";
import { formatTimeAgo } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const DEFAULT_IMAGE_DURATION_SECONDS = 5;

// The story viewer is an always-dark media canvas, so the chrome uses
// literal white/track values instead of theme tokens.
const CHROME_TEXT = "#ffffff";
const PROGRESS_TRACK = "rgba(255, 255, 255, 0.3)";

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
  const params = useLocalSearchParams<{ userId: string }>();
  const authorId = typeof params.userId === "string" ? params.userId : "";
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  // Lazy useState instead of useRef so reading the value in render does
  // not trip the react-hooks/refs rule.
  const [progress] = useState(() => new Animated.Value(0));

  const {
    data: groups,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["stories", user?.id],
    queryFn: () => getActiveStories(user!.id),
    enabled: !!user,
  });

  const group = groups?.find((g) => g.user.id === authorId);
  const stories = group?.stories ?? [];
  const current = stories[index];

  const goNext = () => {
    if (index + 1 < stories.length) {
      setIndex(index + 1);
    } else {
      router.back();
    }
  };

  const goPrev = () => {
    if (index > 0) setIndex(index - 1);
  };

  // Auto-advance images on a timer; video stories advance by tap only in
  // v1, so their bar stays empty while they play.
  useEffect(() => {
    if (!current) return;
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
  }, [current?.id]);

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

  const authorName = group
    ? group.user.display_name || group.user.username
    : "";

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, animation: "fade" }} />

      {isPending ? (
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      ) : isError ? (
        <EmptyState
          title="Stories did not load"
          description="Check your connection and try again."
          action={<Button label="Retry" variant="outline" onPress={() => refetch()} />}
        />
      ) : !group || !current ? (
        <EmptyState
          title="Story unavailable"
          description="These stories may have expired."
          action={<Button label="Close" variant="outline" onPress={() => router.back()} />}
        />
      ) : (
        <>
          {current.media_type === "video" ? (
            <StoryVideo key={current.id} story={current} />
          ) : (
            <Image
              source={{ uri: current.media_url }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              transition={100}
              alt={`Story from ${authorName}`}
            />
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous story"
            style={styles.prevZone}
            onPress={goPrev}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next story"
            style={styles.nextZone}
            onPress={goNext}
          />

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
              <Text style={styles.author} numberOfLines={1}>
                {authorName}
              </Text>
              <Text style={styles.time}>{formatTimeAgo(current.created_at)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close stories"
                onPress={() => router.back()}
                hitSlop={10}
                style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="close" size={26} color={CHROME_TEXT} />
              </Pressable>
            </View>
          </View>
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
  progressRow: {
    flexDirection: "row",
    gap: spacing(1),
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: radii.full,
    backgroundColor: PROGRESS_TRACK,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: CHROME_TEXT,
  },
  progressFillFull: {
    height: "100%",
    width: "100%",
    backgroundColor: CHROME_TEXT,
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
});
