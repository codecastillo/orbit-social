import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Field } from "@/components/ui";
import { StoryOverlayLayer } from "@/components/story-overlays";
import {
  createStory,
  uploadStoryMedia,
  type StoryOverlayPosition,
  type StorySticker,
  type StoryTextOverlay,
  type StoryVisibility,
} from "@/lib/queries/stories";
import { captureVideoPoster } from "@/lib/video-frame";
import { colors, radii, spacing } from "@/lib/theme";

// Same ceiling as the web story creator so stories stay interchangeable.
const MAX_VIDEO_DURATION_SECONDS = 30;

const POSITIONS: { value: StoryOverlayPosition; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom", label: "Bottom" },
];

interface PickedMedia {
  uri: string;
  mimeType: string;
  type: "image" | "video";
  // Seconds; only set for videos.
  durationSeconds: number | null;
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          onPress={() => onChange(option.value)}
          style={[styles.chip, value === option.value && styles.chipActive]}
        >
          <Text
            style={[
              styles.chipLabel,
              value === option.value && styles.chipLabelActive,
            ]}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
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

export default function CreateStoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<StoryVisibility>("public");
  const [captionText, setCaptionText] = useState("");
  const [captionPosition, setCaptionPosition] =
    useState<StoryOverlayPosition>("bottom");
  const [captionSize, setCaptionSize] = useState<"small" | "large">("small");
  const [mentionValue, setMentionValue] = useState("");
  const [mentionPosition, setMentionPosition] =
    useState<StoryOverlayPosition>("center");
  const [linkValue, setLinkValue] = useState("");
  const [linkPosition, setLinkPosition] =
    useState<StoryOverlayPosition>("bottom");

  const textOverlay: StoryTextOverlay | null = captionText.trim()
    ? {
        text: captionText.trim(),
        position: captionPosition,
        size: captionSize,
      }
    : null;

  const stickers: StorySticker[] = [];
  if (mentionValue.trim()) {
    stickers.push({
      type: "mention",
      value: mentionValue.trim().replace(/^@/, ""),
      position: mentionPosition,
    });
  }
  if (linkValue.trim()) {
    const raw = linkValue.trim();
    stickers.push({
      type: "link",
      value: /^https?:\/\//i.test(raw) ? raw : `https://${raw}`,
      position: linkPosition,
    });
  }

  const shareMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You need to be signed in to share a moment.");
      if (!media) throw new Error("Pick a photo or video first.");

      const url = await uploadStoryMedia(user.id, media.uri, media.mimeType);

      let thumbnailUrl: string | undefined;
      if (media.type === "video") {
        // A failed frame grab should not block the share; the viewer falls
        // back to the video itself.
        try {
          const poster = await captureVideoPoster(media.uri);
          thumbnailUrl = await uploadStoryMedia(user.id, poster.uri, "image/jpeg");
        } catch {
          thumbnailUrl = undefined;
        }
      }

      return createStory(user.id, url, visibility, {
        mediaType: media.type,
        thumbnailUrl,
        durationSeconds:
          media.type === "video" && media.durationSeconds
            ? Math.ceil(media.durationSeconds)
            : undefined,
        textOverlay: textOverlay ?? undefined,
        interactiveData: stickers.length > 0 ? { stickers } : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      router.back();
    },
  });

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const isVideo = asset.type === "video";
    // ImagePicker reports video duration in milliseconds.
    const durationSeconds = isVideo && asset.duration ? asset.duration / 1000 : null;

    if (durationSeconds && durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
      setPickError(`Videos can be up to ${MAX_VIDEO_DURATION_SECONDS} seconds.`);
      return;
    }

    setPickError(null);
    setMedia({
      uri: asset.uri,
      mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
      type: isVideo ? "video" : "image",
      durationSeconds,
    });
  };

  const canShare = !!media && !shareMutation.isPending;

  return (
    <View style={styles.fill}>
      <Stack.Screen
        options={{
          title: "New moment",
          presentation: "modal",
          headerTitleAlign: "center",
          headerTitleStyle: { fontSize: 16, fontWeight: "700" },
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share moment"
              disabled={!canShare}
              onPress={() => shareMutation.mutate()}
              style={({ pressed }) => [
                styles.actionPill,
                pressed && { opacity: 0.85 },
                !canShare && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.actionPillLabel}>
                {shareMutation.isPending ? "Sharing" : "Share"}
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {media ? (
          <View style={styles.previewWrap}>
            {media.type === "video" ? (
              <VideoPreview key={media.uri} uri={media.uri} />
            ) : (
              <Image
                source={{ uri: media.uri }}
                alt="Moment preview"
                style={StyleSheet.absoluteFill}
                contentFit="contain"
              />
            )}
            <StoryOverlayLayer textOverlay={textOverlay} stickers={stickers} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change media"
              onPress={pickMedia}
              disabled={shareMutation.isPending}
              style={({ pressed }) => [styles.changeChip, pressed && { opacity: 0.7 }]}
              hitSlop={8}
            >
              <Ionicons name="images-outline" size={14} color={colors.foreground} />
              <Text style={styles.changeChipLabel}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a photo or video"
            onPress={pickMedia}
            style={({ pressed }) => [styles.picker, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="image-outline" size={40} color={colors.mutedForeground} />
            <Text style={styles.pickerLabel}>Choose a photo or video</Text>
            <Text style={styles.pickerHint}>
              Moments disappear after 24 hours. Videos up to{" "}
              {MAX_VIDEO_DURATION_SECONDS} seconds.
            </Text>
          </Pressable>
        )}

        {media ? (
          <View style={styles.editor}>
            <Field
              placeholder="Add a caption"
              value={captionText}
              onChangeText={setCaptionText}
              maxLength={120}
            />
            {captionText.trim() ? (
              <View style={styles.chipGroups}>
                <ChipRow
                  options={POSITIONS}
                  value={captionPosition}
                  onChange={setCaptionPosition}
                />
                <ChipRow
                  options={[
                    { value: "small" as const, label: "Small" },
                    { value: "large" as const, label: "Large" },
                  ]}
                  value={captionSize}
                  onChange={setCaptionSize}
                />
              </View>
            ) : null}

            <Field
              placeholder="Mention someone (@username)"
              value={mentionValue}
              onChangeText={setMentionValue}
              autoCapitalize="none"
              maxLength={30}
            />
            {mentionValue.trim() ? (
              <View style={styles.chipGroups}>
                <ChipRow
                  options={POSITIONS}
                  value={mentionPosition}
                  onChange={setMentionPosition}
                />
              </View>
            ) : null}

            <Field
              placeholder="Add a link (https://...)"
              value={linkValue}
              onChangeText={setLinkValue}
              autoCapitalize="none"
              keyboardType="url"
              maxLength={200}
            />
            {linkValue.trim() ? (
              <View style={styles.chipGroups}>
                <ChipRow
                  options={POSITIONS}
                  value={linkPosition}
                  onChange={setLinkPosition}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.visibilityRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setVisibility("public")}
              style={[
                styles.visibilityChip,
                visibility === "public" && styles.visibilityChipActive,
              ]}
            >
              <Ionicons
                name="earth"
                size={14}
                color={visibility === "public" ? colors.primaryForeground : colors.textSecondary}
              />
              <Text
                style={[
                  styles.visibilityChipLabel,
                  visibility === "public" && styles.visibilityChipLabelActive,
                ]}
              >
                Public
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setVisibility("close_friends")}
              style={[
                styles.visibilityChip,
                visibility === "close_friends" && styles.visibilityChipActive,
              ]}
            >
              <Ionicons
                name="people"
                size={14}
                color={
                  visibility === "close_friends"
                    ? colors.primaryForeground
                    : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.visibilityChipLabel,
                  visibility === "close_friends" && styles.visibilityChipLabelActive,
                ]}
              >
                Close friends
              </Text>
            </Pressable>
          </View>
          {pickError ? <Text style={styles.error}>{pickError}</Text> : null}
          {shareMutation.error ? (
            <Text style={styles.error}>
              {shareMutation.error instanceof Error
                ? shareMutation.error.message
                : "The moment could not be shared."}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing(6),
  },
  cancelLabel: {
    color: colors.foreground,
    fontSize: 15,
  },
  actionPill: {
    minHeight: 32,
    paddingHorizontal: spacing(4),
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPillLabel: {
    color: colors.primaryForeground,
    fontSize: 13.5,
    fontWeight: "700",
  },
  previewWrap: {
    aspectRatio: 9 / 16,
    maxHeight: 420,
    alignSelf: "center",
    margin: spacing(4),
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  changeChip: {
    position: "absolute",
    bottom: spacing(3),
    right: spacing(3),
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    borderRadius: radii.full,
    backgroundColor: "rgba(11, 11, 13, 0.7)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  changeChipLabel: {
    color: colors.foreground,
    fontSize: 12.5,
    fontWeight: "600",
  },
  picker: {
    // A definite height: aspectRatio without a definite width collapses the
    // box to its text's intrinsic width and the labels render vertically.
    height: 380,
    alignSelf: "stretch",
    margin: spacing(4),
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2),
    paddingHorizontal: spacing(6),
  },
  pickerLabel: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  pickerHint: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    textAlign: "center",
  },
  editor: {
    paddingHorizontal: spacing(4),
  },
  chipGroups: {
    gap: spacing(2),
    // Pull the chips up against the Field's baked-in bottom margin.
    marginTop: -spacing(2),
    marginBottom: spacing(4),
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing(2),
  },
  chip: {
    paddingHorizontal: spacing(3),
    minHeight: 30,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipLabel: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontWeight: "600",
  },
  chipLabelActive: {
    color: colors.primaryForeground,
  },
  footer: {
    paddingHorizontal: spacing(4),
    gap: spacing(3),
  },
  visibilityRow: {
    flexDirection: "row",
    gap: spacing(2),
  },
  visibilityChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(1.5),
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
  },
  visibilityChipActive: {
    backgroundColor: colors.primary,
  },
  visibilityChipLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  visibilityChipLabelActive: {
    color: colors.primaryForeground,
  },
  error: {
    color: colors.destructive,
    fontSize: 13,
  },
});
