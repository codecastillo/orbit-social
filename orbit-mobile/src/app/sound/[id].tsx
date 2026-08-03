import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Centered, EmptyState } from "@/components/ui";
import {
  getClipsBySound,
  getSound,
  type ClipWithAuthor,
} from "@/lib/queries/clips";
import { useVideoFrame } from "@/lib/video-frame";
import { stageSoundSeed } from "@/lib/sound-seed";
import { formatNumber } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const GRID_COLUMNS = 3;
const TILE_ASPECT = 16 / 9;

function ClipTile({
  clip,
  width,
  onPress,
}: {
  clip: ClipWithAuthor;
  width: number;
  onPress: () => void;
}) {
  const media = clip.post_media[0];
  // The camera flow uploads no cover frame, so fall back to decoding one
  // from the video, same as the profile grid.
  const frame = useVideoFrame(media && !media.thumbnail_url ? media.url : null);
  const source = media?.thumbnail_url ?? frame;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open clip by ${clip.profiles.username}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { width, height: width * TILE_ASPECT },
        pressed && { opacity: 0.8 },
      ]}
    >
      {source ? (
        <Image
          source={{ uri: source }}
          alt={clip.content ?? "Clip"}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.tilePlaceholder]} />
      )}
      <View style={styles.tileMetric}>
        <Ionicons name="play" size={11} color="#fff" />
        <Text style={styles.tileMetricText}>
          {formatNumber(clip.view_count)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function SoundScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const { data: sound } = useQuery({
    queryKey: ["sound", id],
    queryFn: () => getSound(id),
  });

  const {
    data: clips,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["sound-clips", id, user?.id],
    queryFn: () => getClipsBySound(id, user!.id),
    enabled: !!user,
  });

  const title = sound
    ? sound.artist
      ? `${sound.name} · ${sound.artist}`
      : sound.name
    : "Sound";

  const handleUseSound = useCallback(() => {
    stageSoundSeed({ id, label: title });
    router.push("/clip-camera");
  }, [id, title, router]);

  const gutter = spacing(4);
  const gap = spacing(1);
  const tileWidth =
    (screenWidth - gutter * 2 - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  if (isPending) {
    return (
      <Centered>
        <Stack.Screen options={{ title: "Sound" }} />
        <ActivityIndicator color={colors.primary} />
      </Centered>
    );
  }

  const useCount = sound?.use_count ?? 0;

  return (
    <>
      <Stack.Screen options={{ title: sound?.name ?? "Sound" }} />
      <FlatList
        style={styles.list}
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingBottom: spacing(8),
        }}
        data={clips ?? []}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={{ gap }}
        keyExtractor={(clip) => clip.id}
        renderItem={({ item }) => (
          <ClipTile
            clip={item}
            width={tileWidth}
            onPress={() => router.push(`/post/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: gap }} />}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>
              ◆ SOUND · {formatNumber(useCount)} USE{useCount === 1 ? "" : "S"}
            </Text>
            <View style={styles.heroTitleRow}>
              <Ionicons name="musical-notes" size={22} color={colors.primary} />
              <Text style={styles.heroTitle} numberOfLines={2}>
                {sound?.name ?? "Sound"}
                {sound?.artist ? (
                  <Text style={styles.heroArtist}> · {sound.artist}</Text>
                ) : null}
              </Text>
            </View>
            <Text style={styles.heroSub}>
              Every clip made with this sound. Your clip keeps its own audio,
              audio mixing comes later.
            </Text>
            <Button label="Use this sound" onPress={handleUseSound} />
          </View>
        }
        ListEmptyComponent={
          isError ? (
            <EmptyState
              title="Clips did not load"
              description="Check your connection and try again."
              action={
                <Button
                  label="Retry"
                  variant="outline"
                  onPress={() => refetch()}
                />
              }
            />
          ) : (
            <EmptyState
              title="Nothing on this sound"
              description="No clips use this sound yet. Be the first."
            />
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    gap: spacing(2.5),
    paddingTop: spacing(4),
    paddingBottom: spacing(5),
    alignItems: "flex-start",
  },
  eyebrow: {
    color: colors.mutedForeground,
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.6,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
  },
  heroTitle: {
    flex: 1,
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  heroArtist: {
    color: colors.primary,
  },
  heroSub: {
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
  },
  tile: {
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  tilePlaceholder: {
    backgroundColor: colors.surface,
  },
  tileMetric: {
    position: "absolute",
    left: spacing(1.5),
    bottom: spacing(1.5),
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
  },
  tileMetricText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
});
