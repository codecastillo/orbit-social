import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { VideoView, useVideoPlayer } from "expo-video";
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
import { uploadVideoPoster } from "@/lib/video-frame";
import { consumeSoundSeed } from "@/lib/sound-seed";
import { safeBack } from "@/lib/nav";
import { colors, radii, spacing } from "@/lib/theme";

// Total recording budget across all takes. v1 spends it in a single hold;
// the segments array and bar already speak multi-segment so additional
// holds can drop in once concatenation is possible.
const CLIP_MAX_MS = 8000;
// A press released before the encoder spins up yields an empty or broken
// file; discard anything shorter.
const MIN_SEGMENT_MS = 300;
const PROGRESS_TICK_MS = 50;
const CAPTION_MAX_LENGTH = 200;

// The camera is an always-dark media canvas, so the chrome uses literal
// white/scrim values instead of theme tokens, matching the story viewer.
const CHROME_TEXT = "#ffffff";
const CHROME_SCRIM = "rgba(11, 11, 13, 0.55)";
const CHROME_HAIRLINE = "rgba(255, 255, 255, 0.2)";
const PROGRESS_TRACK = "rgba(255, 255, 255, 0.3)";

interface ClipSegment {
  uri: string;
  durationMs: number;
}

function segmentsTotalMs(segments: ClipSegment[]): number {
  return segments.reduce((sum, s) => sum + s.durationMs, 0);
}

// iOS recordAsync writes .mov; Android writes .mp4.
function videoMimeType(uri: string): string {
  return uri.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4";
}

function ClipPreview({ uri, muted }: { uri: string; muted: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

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

// Vine-style progress bar: violet fill over a translucent track, with tick
// marks at the boundaries between completed segments.
function SegmentsBar({
  segments,
  liveMs,
}: {
  segments: ClipSegment[];
  liveMs: number;
}) {
  const totalMs = Math.min(segmentsTotalMs(segments) + liveMs, CLIP_MAX_MS);

  // Boundaries fall at the end of each completed segment except the last
  // one overall (a tick at the very end of the fill would be noise).
  const ticks: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < segments.length - (liveMs > 0 ? 0 : 1); i++) {
    cumulative += segments[i].durationMs;
    ticks.push(Math.min(cumulative / CLIP_MAX_MS, 1) * 100);
  }

  return (
    <View
      style={styles.progressTrack}
      accessibilityRole="progressbar"
      accessibilityLabel="Recording progress"
      accessibilityValue={{ min: 0, max: CLIP_MAX_MS, now: Math.round(totalMs) }}
    >
      <View style={[styles.progressFill, { width: `${(totalMs / CLIP_MAX_MS) * 100}%` }]} />
      {ticks.map((pct) => (
        <View key={pct} style={[styles.progressTickMark, { left: `${pct}%` }]} />
      ))}
    </View>
  );
}

export default function ClipCameraScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [facing, setFacing] = useState<"back" | "front">("back");

  const [segments, setSegments] = useState<ClipSegment[]>([]);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const recordingRef = useRef(false);
  const pressStartRef = useRef(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<"capture" | "preview">("capture");
  const [previewMuted, setPreviewMuted] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [caption, setCaption] = useState("");
  // Sound staged by the sound page's "Use this sound"; credits that sound
  // rather than minting an original one for this clip.
  const [soundSeed] = useState(() => consumeSoundSeed());
  const captionRef = useRef<MentionInputHandle>(null);

  // Lazy useState instead of useRef so reading the value in render does
  // not trip the react-hooks/refs rule.
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!recording) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [recording, pulse]);

  useEffect(() => {
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, []);

  const shareMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You need to be signed in to share a clip.");
      const segment = segments[0];
      if (!segment) throw new Error("Record a clip first.");
      const url = await uploadPostMedia(user.id, segment.uri, videoMimeType(segment.uri));
      // recordAsync reports no dimensions, so the poster frame is the only
      // dimension source: it comes out at the recorded video's own size.
      const poster = await uploadVideoPoster(user.id, segment.uri);
      return createReelPost(user.id, caption.trim(), {
        url,
        width: poster?.width ?? null,
        height: poster?.height ?? null,
        thumbnailUrl: poster?.url ?? null,
        durationMs: segmentsTotalMs(segments),
        soundId: soundSeed?.id ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clips"] });
      router.replace("/(tabs)/clips");
    },
  });

  const committedMs = segmentsTotalMs(segments);
  const remainingMs = Math.max(0, CLIP_MAX_MS - committedMs);

  const startRecording = async () => {
    if (recordingRef.current || !cameraReady || remainingMs <= 0) return;
    recordingRef.current = true;
    setRecording(true);
    pressStartRef.current = Date.now();
    setElapsedMs(0);
    tickerRef.current = setInterval(() => {
      setElapsedMs(Math.min(Date.now() - pressStartRef.current, remainingMs));
    }, PROGRESS_TICK_MS);

    try {
      // Resolves when stopRecording fires on release or maxDuration caps
      // the take, so held time comes from timestamps around the press.
      const video = await cameraRef.current?.recordAsync({
        maxDuration: Math.ceil(remainingMs / 1000),
      });
      const heldMs = Math.min(Date.now() - pressStartRef.current, remainingMs);
      if (video?.uri && heldMs >= MIN_SEGMENT_MS) {
        setSegments((prev) => [...prev, { uri: video.uri, durationMs: heldMs }]);
        // Single-hold v1: one release finishes the clip. When multi-segment
        // recording becomes possible this branches on remaining budget.
        setPhase("preview");
      }
    } catch {
      // The encoder can fail on an instant tap; drop the take and let the
      // user press again.
    } finally {
      if (tickerRef.current) {
        clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
      recordingRef.current = false;
      setRecording(false);
      setElapsedMs(0);
    }
  };

  const stopRecording = () => {
    cameraRef.current?.stopRecording();
  };

  const retake = () => {
    setSegments([]);
    setCaption("");
    setShowCaption(false);
    setPreviewMuted(false);
    shareMutation.reset();
    setPhase("capture");
  };

  // Null while the OS is still resolving permission state.
  if (!cameraPermission || !micPermission) {
    return <View style={styles.fill} />;
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    const blockedForever =
      (!cameraPermission.granted && !cameraPermission.canAskAgain) ||
      (!micPermission.granted && !micPermission.canAskAgain);

    const requestBoth = async () => {
      if (!cameraPermission.granted) await requestCameraPermission();
      if (!micPermission.granted) await requestMicPermission();
    };

    return (
      <View style={[styles.fill, styles.permissionWrap]}>
        <Stack.Screen options={{ headerShown: false, presentation: "fullScreenModal" }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close camera"
          onPress={() => safeBack(router)}
          hitSlop={12}
          style={[styles.chromeButton, styles.closeButton, { top: insets.top + spacing(3) }]}
        >
          <Ionicons name="close" size={24} color={CHROME_TEXT} />
        </Pressable>
        <Ionicons name="videocam-outline" size={44} color={colors.mutedForeground} />
        <Text style={styles.permissionTitle}>Camera and microphone</Text>
        <Text style={styles.permissionBody}>
          Clips are short videos recorded while you hold the button. Orbit needs the
          camera to film and the microphone for sound.
        </Text>
        {blockedForever ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => Linking.openSettings()}
            style={({ pressed }) => [styles.permissionButton, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.permissionButtonLabel}>Open settings</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Allow camera and microphone"
            onPress={requestBoth}
            style={({ pressed }) => [styles.permissionButton, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.permissionButtonLabel}>Allow access</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const liveMs = recording ? elapsedMs : 0;
  const remainingSeconds = Math.max(0, CLIP_MAX_MS - committedMs - liveMs) / 1000;
  const previewUri = segments[0]?.uri;

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ headerShown: false, presentation: "fullScreenModal" }} />

      {phase === "capture" ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          mode="video"
          facing={facing}
          onCameraReady={() => setCameraReady(true)}
        />
      ) : previewUri ? (
        <ClipPreview uri={previewUri} muted={previewMuted} />
      ) : null}

      {recording ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.recordingBorder,
            { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] }) },
          ]}
        />
      ) : null}

      <View style={[styles.topBar, { top: insets.top + spacing(3) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close camera"
          onPress={() => safeBack(router)}
          hitSlop={12}
          style={({ pressed }) => [styles.chromeButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="close" size={24} color={CHROME_TEXT} />
        </Pressable>
        <SegmentsBar segments={segments} liveMs={liveMs} />
        {phase === "capture" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Flip camera"
            onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
            disabled={recording}
            hitSlop={12}
            style={({ pressed }) => [
              styles.chromeButton,
              pressed && { opacity: 0.7 },
              recording && { opacity: 0.4 },
            ]}
          >
            <Ionicons name="camera-reverse-outline" size={24} color={CHROME_TEXT} />
          </Pressable>
        ) : (
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
        )}
      </View>

      {phase === "capture" ? (
        <View style={[styles.captureControls, { bottom: insets.bottom + spacing(8) }]}>
          <Text style={styles.remainingCounter}>{remainingSeconds.toFixed(1)}s</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hold to record"
            accessibilityHint="Recording runs while you hold, up to eight seconds"
            onPressIn={startRecording}
            onPressOut={stopRecording}
            disabled={!cameraReady}
            style={[styles.recordRing, !cameraReady && { opacity: 0.4 }]}
          >
            <View style={[styles.recordCore, recording && styles.recordCoreActive]} />
          </Pressable>
          <Text style={styles.holdHint}>Hold to record</Text>
        </View>
      ) : null}

      {phase === "preview" && !showCaption ? (
        <View style={[styles.previewControls, { bottom: insets.bottom + spacing(8) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retake clip"
            onPress={retake}
            style={({ pressed }) => [styles.previewButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="refresh-outline" size={18} color={CHROME_TEXT} />
            <Text style={styles.previewButtonLabel}>Retake</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a caption and share"
            onPress={() => setShowCaption(true)}
            style={({ pressed }) => [
              styles.previewButton,
              styles.previewButtonPrimary,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={[styles.previewButtonLabel, styles.previewButtonPrimaryLabel]}>
              Next
            </Text>
            <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
          </Pressable>
        </View>
      ) : null}

      {phase === "preview" && showCaption ? (
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
  permissionWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(8),
    gap: spacing(3),
  },
  permissionTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "700",
  },
  permissionBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  permissionButton: {
    marginTop: spacing(2),
    minHeight: 44,
    paddingHorizontal: spacing(6),
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionButtonLabel: {
    color: colors.primaryForeground,
    fontSize: 14.5,
    fontWeight: "700",
  },
  closeButton: {
    position: "absolute",
    left: spacing(4),
  },
  topBar: {
    position: "absolute",
    left: spacing(4),
    right: spacing(4),
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
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
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: PROGRESS_TRACK,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressTickMark: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: CHROME_TEXT,
  },
  recordingBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  captureControls: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: spacing(3),
  },
  remainingCounter: {
    color: CHROME_TEXT,
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
    borderRadius: radii.full,
    backgroundColor: CHROME_SCRIM,
    overflow: "hidden",
  },
  recordRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: CHROME_TEXT,
    alignItems: "center",
    justifyContent: "center",
  },
  recordCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
  },
  recordCoreActive: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  holdHint: {
    color: CHROME_TEXT,
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.9,
  },
  previewControls: {
    position: "absolute",
    left: spacing(4),
    right: spacing(4),
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing(3),
  },
  previewButton: {
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
  previewButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  previewButtonLabel: {
    color: CHROME_TEXT,
    fontSize: 14.5,
    fontWeight: "700",
  },
  previewButtonPrimaryLabel: {
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
