import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEvent } from "expo";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MentionButton,
  MentionInput,
  type MentionInputHandle,
} from "@/components/mention-input";
import { useAuth } from "@/providers/auth-provider";
import { createReelPost, uploadPostMedia } from "@/lib/queries/posts";
import { consumeSoundSeed } from "@/lib/sound-seed";
import { safeBack } from "@/lib/nav";
import { colors, radii, spacing } from "@/lib/theme";

// Selection is metadata only in v1 (no on-device re-encode in Expo Go), so
// it drives duration_ms (lane placement) and the default cover, while the
// full video uploads. Server-side trimming lands with the media pipeline.
const TRIM_MAX_MS = 60_000;
// A selection thinner than this is un-draggable and meaningless as a lane
// signal.
const MIN_TRIM_MS = 1000;
// Mirrors the clips feed All/Loops split.
const LOOP_LANE_MAX_MS = 8000;
const FRAME_COUNT = 9;
const CAPTION_MAX_LENGTH = 200;

// Same always-dark media-canvas chrome as clip-camera.
const CHROME_TEXT = "#ffffff";
const CHROME_SCRIM = "rgba(11, 11, 13, 0.55)";
const CHROME_HAIRLINE = "rgba(255, 255, 255, 0.2)";
const STRIP_DIM = "rgba(11, 11, 13, 0.7)";

const STRIP_HEIGHT = 52;
const HANDLE_WIDTH = 18;

interface PickedVideo {
  uri: string;
  mimeType: string;
  width: number | null;
  height: number | null;
}

interface StripFrame {
  timeMs: number;
  uri: string;
}

// Library assets on iOS are often .mov; Android is .mp4.
function videoMimeType(uri: string): string {
  return uri.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function UploadPreview({
  uri,
  muted,
  onDurationMs,
}: {
  uri: string;
  muted: boolean;
  onDurationMs: (durationMs: number) => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  const status = useEvent(player, "statusChange");

  // Fallback duration source for assets whose picker metadata lacks one.
  useEffect(() => {
    if (status?.status === "readyToPlay" && player.duration > 0) {
      onDurationMs(Math.round(player.duration * 1000));
    }
  }, [status, player, onDurationMs]);

  useEffect(() => {
    // expo-video players are driven by property assignment; same targeted
    // disable the clips feed uses.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
  }, [player, muted]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export default function ClipUploadScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [frames, setFrames] = useState<StripFrame[]>([]);
  const [selStartMs, setSelStartMs] = useState(0);
  const [selEndMs, setSelEndMs] = useState(0);
  const [coverIndex, setCoverIndex] = useState(0);
  const [stripWidth, setStripWidth] = useState(0);
  const [previewMuted, setPreviewMuted] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [caption, setCaption] = useState("");
  // Sound staged by the sound page's "Use this sound"; credits that sound
  // rather than minting an original one for this clip.
  const [soundSeed] = useState(() => consumeSoundSeed());
  const captionRef = useRef<MentionInputHandle>(null);

  // Live values for the pan handlers, which outlive any single render.
  const selStartRef = useRef(0);
  const selEndRef = useRef(0);
  const durationRef = useRef(0);
  const stripWidthRef = useRef(0);
  const dragBaseRef = useRef(0);
  // Once the user taps a cover, selection changes stop moving it.
  const coverPickedRef = useRef(false);
  const pickerOpenedRef = useRef(false);
  const hasVideoRef = useRef(false);

  const setSelection = useCallback((startMs: number, endMs: number) => {
    selStartRef.current = startMs;
    selEndRef.current = endMs;
    setSelStartMs(startMs);
    setSelEndMs(endMs);
  }, []);

  // Single entry point for the duration, whichever source resolves it, so
  // the default selection seeds exactly once per picked video.
  const applyDuration = useCallback(
    (ms: number) => {
      durationRef.current = ms;
      setDurationMs(ms);
      setSelection(0, Math.min(ms, TRIM_MAX_MS));
    },
    [setSelection],
  );

  const pickVideo = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
    });
    if (result.canceled || !result.assets[0]) {
      // Backing out of the picker with nothing chosen closes the screen.
      if (!hasVideoRef.current) safeBack(router);
      return;
    }
    const asset = result.assets[0];
    coverPickedRef.current = false;
    hasVideoRef.current = true;
    setFrames([]);
    setCoverIndex(0);
    // Picker duration is in milliseconds; null falls back to the player.
    if (asset.duration && asset.duration > 0) {
      applyDuration(Math.round(asset.duration));
    } else {
      durationRef.current = 0;
      setDurationMs(null);
      setSelection(0, 0);
    }
    setVideo({
      uri: asset.uri,
      mimeType: asset.mimeType ?? videoMimeType(asset.uri),
      width: asset.width || null,
      height: asset.height || null,
    });
  }, [router, setSelection, applyDuration]);

  useEffect(() => {
    if (pickerOpenedRef.current) return;
    pickerOpenedRef.current = true;
    pickVideo();
  }, [pickVideo]);

  // Fallback for assets whose picker metadata carried no duration; the
  // picker value, when present, already won.
  const handleDurationMs = useCallback(
    (ms: number) => {
      if (durationRef.current > 0) return;
      applyDuration(ms);
    },
    [applyDuration],
  );

  // Duration arriving (from the picker or the player) kicks off frame
  // generation for the trim strip and cover row.
  useEffect(() => {
    if (!video || durationMs == null || durationMs <= 0) return;

    let cancelled = false;
    (async () => {
      const generated: StripFrame[] = [];
      for (let i = 0; i < FRAME_COUNT; i++) {
        const timeMs = Math.round(((i + 0.5) / FRAME_COUNT) * durationMs);
        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(video.uri, {
            time: timeMs,
            quality: 0.6,
          });
          generated.push({ timeMs, uri });
        } catch {
          // A single unreadable frame leaves a gap in the strip; the rest
          // still land.
        }
        if (cancelled) return;
      }
      if (!cancelled) setFrames(generated);
    })();
    return () => {
      cancelled = true;
    };
  }, [video, durationMs]);

  // The default cover follows the selection start until the user picks one.
  useEffect(() => {
    if (coverPickedRef.current || frames.length === 0) return;
    let nearest = 0;
    for (let i = 1; i < frames.length; i++) {
      if (
        Math.abs(frames[i].timeMs - selStartMs) <
        Math.abs(frames[nearest].timeMs - selStartMs)
      ) {
        nearest = i;
      }
    }
    setCoverIndex(nearest);
  }, [selStartMs, frames]);

  // Lazy useState so the PanResponders are built once. Their callbacks fire
  // only during native gestures, never during render; the refs rule cannot
  // know PanResponder.create defers them, so it is opted out here.
  // eslint-disable-next-line react-hooks/refs
  const [startHandlePan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragBaseRef.current = selStartRef.current;
      },
      onPanResponderMove: (_evt, gesture) => {
        const duration = durationRef.current;
        const width = stripWidthRef.current;
        if (duration <= 0 || width <= 0) return;
        let next = dragBaseRef.current + (gesture.dx / width) * duration;
        next = clamp(next, 0, selEndRef.current - MIN_TRIM_MS);
        next = Math.max(next, selEndRef.current - TRIM_MAX_MS);
        selStartRef.current = next;
        setSelStartMs(next);
      },
    }),
  );
  // Same gesture-time-only ref access as the start handle above.
  // eslint-disable-next-line react-hooks/refs
  const [endHandlePan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragBaseRef.current = selEndRef.current;
      },
      onPanResponderMove: (_evt, gesture) => {
        const duration = durationRef.current;
        const width = stripWidthRef.current;
        if (duration <= 0 || width <= 0) return;
        let next = dragBaseRef.current + (gesture.dx / width) * duration;
        next = clamp(next, selStartRef.current + MIN_TRIM_MS, duration);
        next = Math.min(next, selStartRef.current + TRIM_MAX_MS);
        selEndRef.current = next;
        setSelEndMs(next);
      },
    }),
  );

  const shareMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You need to be signed in to share a clip.");
      if (!video || durationMs == null) throw new Error("Pick a video first.");
      const url = await uploadPostMedia(user.id, video.uri, video.mimeType);
      const cover = frames[coverIndex];
      const thumbnailUrl = cover
        ? await uploadPostMedia(user.id, cover.uri, "image/jpeg")
        : null;
      return createReelPost(user.id, caption.trim(), {
        url,
        width: video.width,
        height: video.height,
        durationMs: selEndMs - selStartMs,
        thumbnailUrl,
        soundId: soundSeed?.id ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clips"] });
      router.replace("/(tabs)/clips");
    },
  });

  const selectionMs = selEndMs - selStartMs;
  const isLoopLength = selectionMs > 0 && selectionMs <= LOOP_LANE_MAX_MS;
  const ready = !!video && durationMs != null && durationMs > 0;
  const startPx =
    ready && stripWidth > 0 ? (selStartMs / durationMs) * stripWidth : 0;
  const endPx =
    ready && stripWidth > 0 ? (selEndMs / durationMs) * stripWidth : 0;

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ headerShown: false, presentation: "fullScreenModal" }} />

      {video ? (
        <UploadPreview
          // Keyed so Replace remounts the player; useVideoPlayer does not
          // follow source prop changes.
          key={video.uri}
          uri={video.uri}
          muted={previewMuted}
          onDurationMs={handleDurationMs}
        />
      ) : (
        <View style={styles.pickingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      <View style={[styles.topBar, { top: insets.top + spacing(3) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close upload"
          onPress={() => safeBack(router)}
          hitSlop={12}
          style={({ pressed }) => [styles.chromeButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="close" size={24} color={CHROME_TEXT} />
        </Pressable>
        {video ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={previewMuted ? "Unmute preview" : "Mute preview"}
            onPress={() => setPreviewMuted((m) => !m)}
            hitSlop={12}
            style={({ pressed }) => [styles.chromeButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons
              name={previewMuted ? "volume-mute-outline" : "volume-high-outline"}
              size={24}
              color={CHROME_TEXT}
            />
          </Pressable>
        ) : null}
      </View>

      {video && !showCaption ? (
        <View style={[styles.editPanel, { paddingBottom: insets.bottom + spacing(4) }]}>
          <View style={styles.selectionRow}>
            <Text style={styles.selectionLabel}>
              {ready ? `${(selectionMs / 1000).toFixed(1)}s selected` : "Reading video"}
            </Text>
            {isLoopLength ? (
              <View style={styles.loopChip}>
                <Text style={styles.loopChipText}>LOOP LANE</Text>
              </View>
            ) : null}
          </View>

          <View
            style={styles.strip}
            onLayout={(e) => {
              stripWidthRef.current = e.nativeEvent.layout.width;
              setStripWidth(e.nativeEvent.layout.width);
            }}
          >
            {frames.length === 0 ? (
              <View style={styles.stripLoading}>
                <ActivityIndicator color={colors.primary} size="small" />
              </View>
            ) : (
              <>
                <View style={styles.frameRow}>
                  {frames.map((frame) => (
                    <Image
                      key={frame.timeMs}
                      source={{ uri: frame.uri }}
                      style={styles.frame}
                      contentFit="cover"
                      alt=""
                    />
                  ))}
                </View>
                <View style={[styles.stripDim, { left: 0, width: startPx }]} />
                <View
                  style={[styles.stripDim, { left: endPx, width: Math.max(0, stripWidth - endPx) }]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.selectionFrame,
                    { left: startPx, width: Math.max(0, endPx - startPx) },
                  ]}
                />
                <View
                  {...startHandlePan.panHandlers}
                  accessible
                  accessibilityRole="adjustable"
                  accessibilityLabel="Selection start"
                  style={[styles.handle, { left: startPx - HANDLE_WIDTH / 2 }]}
                  hitSlop={{ top: 12, bottom: 12, left: 16, right: 8 }}
                >
                  <View style={styles.handleBar} />
                </View>
                <View
                  {...endHandlePan.panHandlers}
                  accessible
                  accessibilityRole="adjustable"
                  accessibilityLabel="Selection end"
                  style={[styles.handle, { left: endPx - HANDLE_WIDTH / 2 }]}
                  hitSlop={{ top: 12, bottom: 12, left: 8, right: 16 }}
                >
                  <View style={styles.handleBar} />
                </View>
              </>
            )}
          </View>

          <Text style={styles.coverLabel}>Cover</Text>
          <View style={styles.coverRow}>
            {frames.map((frame, index) => (
              <Pressable
                key={frame.timeMs}
                accessibilityRole="button"
                accessibilityLabel={`Use frame ${index + 1} as cover`}
                accessibilityState={{ selected: index === coverIndex }}
                onPress={() => {
                  coverPickedRef.current = true;
                  setCoverIndex(index);
                }}
                style={[styles.coverCell, index === coverIndex && styles.coverCellActive]}
              >
                <Image
                  source={{ uri: frame.uri }}
                  style={styles.coverImage}
                  contentFit="cover"
                  alt=""
                />
              </Pressable>
            ))}
          </View>

          <Text style={styles.trimNote}>
            Cover and lane are set by your selection. The full video uploads for now.
          </Text>

          <View style={styles.editButtons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose a different video"
              onPress={pickVideo}
              style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="images-outline" size={18} color={CHROME_TEXT} />
              <Text style={styles.editButtonLabel}>Replace</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a caption and share"
              disabled={!ready}
              onPress={() => setShowCaption(true)}
              style={({ pressed }) => [
                styles.editButton,
                styles.editButtonPrimary,
                pressed && { opacity: 0.85 },
                !ready && { opacity: 0.5 },
              ]}
            >
              <Text style={[styles.editButtonLabel, styles.editButtonPrimaryLabel]}>
                Next
              </Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {video && showCaption ? (
        <KeyboardAvoidingView
          style={styles.captionOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.captionSheet, { paddingBottom: insets.bottom + spacing(4) }]}>
            {soundSeed ? (
              <View style={styles.soundNote}>
                <Ionicons name="musical-notes" size={14} color={colors.primary} />
                <Text style={styles.soundNoteText} numberOfLines={2}>
                  {soundSeed.label}. Your clip credits this sound and keeps its
                  own audio.
                </Text>
              </View>
            ) : null}
            <MentionInput
              ref={captionRef}
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a caption"
              placeholderTextColor={colors.textFaint}
              style={styles.captionInput}
              panelPlacement="above"
              multiline
              autoFocus
              maxLength={CAPTION_MAX_LENGTH}
            />
            {shareMutation.error ? (
              <Text style={styles.error}>
                {shareMutation.error instanceof Error
                  ? shareMutation.error.message
                  : "The clip could not be shared."}
              </Text>
            ) : null}
            <View style={styles.captionToolbar}>
              <MentionButton
                onPress={() => captionRef.current?.insertMentionTrigger()}
                disabled={shareMutation.isPending}
              />
              <Text style={styles.captionCounter}>
                {CAPTION_MAX_LENGTH - caption.length}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share clip"
                disabled={shareMutation.isPending}
                onPress={() => shareMutation.mutate()}
                style={({ pressed }) => [
                  styles.sharePill,
                  pressed && { opacity: 0.85 },
                  shareMutation.isPending && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.sharePillLabel}>
                  {shareMutation.isPending ? "Sharing" : "Share"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pickingWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    position: "absolute",
    left: spacing(4),
    right: spacing(4),
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chromeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CHROME_SCRIM,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CHROME_HAIRLINE,
    alignItems: "center",
    justifyContent: "center",
  },
  editPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CHROME_SCRIM,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: CHROME_HAIRLINE,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    gap: spacing(3),
  },
  selectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
  },
  selectionLabel: {
    color: CHROME_TEXT,
    fontSize: 13.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  loopChip: {
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  loopChipText: {
    color: colors.primaryForeground,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  strip: {
    height: STRIP_HEIGHT,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  stripLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  frameRow: {
    flexDirection: "row",
    height: "100%",
  },
  frame: {
    flex: 1,
    height: "100%",
  },
  stripDim: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: STRIP_DIM,
  },
  selectionFrame: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.sm,
  },
  handle: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: HANDLE_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  handleBar: {
    width: 6,
    height: STRIP_HEIGHT - 16,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  coverLabel: {
    color: CHROME_TEXT,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    opacity: 0.8,
  },
  coverRow: {
    flexDirection: "row",
    gap: spacing(1.5),
  },
  coverCell: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: radii.sm,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  coverCellActive: {
    borderColor: colors.primary,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  trimNote: {
    color: CHROME_TEXT,
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.75,
  },
  editButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing(3),
    marginTop: spacing(1),
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    minHeight: 48,
    paddingHorizontal: spacing(6),
    borderRadius: radii.full,
    backgroundColor: CHROME_SCRIM,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CHROME_HAIRLINE,
  },
  editButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  editButtonLabel: {
    color: CHROME_TEXT,
    fontSize: 14.5,
    fontWeight: "700",
  },
  editButtonPrimaryLabel: {
    color: colors.primaryForeground,
  },
  captionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  captionSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    gap: spacing(3),
  },
  soundNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  soundNoteText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  captionInput: {
    color: colors.foreground,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 64,
    textAlignVertical: "top",
  },
  captionToolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(4),
  },
  captionCounter: {
    marginLeft: "auto",
    color: colors.mutedForeground,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  sharePill: {
    minHeight: 36,
    paddingHorizontal: spacing(5),
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sharePillLabel: {
    color: colors.primaryForeground,
    fontSize: 13.5,
    fontWeight: "700",
  },
  error: {
    color: colors.destructive,
    fontSize: 13,
  },
});
