import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Field } from "@/components/ui";
import { StoryOverlayLayer } from "@/components/story-overlays";
import { useAuth } from "@/providers/auth-provider";
import {
  createStory,
  uploadStoryMedia,
  type StoryVisibility,
} from "@/lib/queries/stories";
import {
  addStoriesToHighlight,
  createHighlight,
  getHighlights,
} from "@/lib/queries/highlights";
import { safeBack } from "@/lib/nav";
import { colors, radii, spacing } from "@/lib/theme";

// Expo Go cannot drive both cameras at once, so the dual capture is
// sequential: primary shot on tap, then the camera flips and the second
// shot fires itself after this countdown.
const COUNTDOWN_TICKS = 3;
const COUNTDOWN_TICK_MS = 800;
const PHOTO_QUALITY = 0.85;
// Where the front photo composites over the back photo; the viewer renders
// the same corner from interactive_data.selfie.position.
const SELFIE_CORNER = "top-left" as const;
// Same ceiling as the web highlights route.
const MAX_COLLECTION_TITLE_LENGTH = 40;

// The camera is an always-dark media canvas, so the chrome uses literal
// white/scrim values instead of theme tokens, matching the clip camera.
const CHROME_TEXT = "#ffffff";
const CHROME_SCRIM = "rgba(11, 11, 13, 0.55)";
const CHROME_HAIRLINE = "rgba(255, 255, 255, 0.2)";

type CameraFacing = "back" | "front";
type Phase = "first" | "countdown" | "preview";

type CollectionChoice =
  | { kind: "none" }
  | { kind: "existing"; id: string; title: string }
  | { kind: "new" };

function opposite(facing: CameraFacing): CameraFacing {
  return facing === "back" ? "front" : "back";
}

export default function MomentCameraScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Which camera shoots first (and lands as the big base photo).
  const [primaryFacing, setPrimaryFacing] = useState<CameraFacing>("back");
  const [facing, setFacing] = useState<CameraFacing>("back");

  const [phase, setPhase] = useState<Phase>("first");
  const [countdown, setCountdown] = useState(COUNTDOWN_TICKS);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  // firstUri is the primary camera's shot, secondUri the flipped one.
  const [firstUri, setFirstUri] = useState<string | null>(null);
  const [secondUri, setSecondUri] = useState<string | null>(null);
  // Preview tap on the PiP swaps which photo uploads as the big base.
  const [swapped, setSwapped] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [visibility, setVisibility] = useState<StoryVisibility>("public");
  const [collection, setCollection] = useState<CollectionChoice>({
    kind: "none",
  });
  const [newCollectionTitle, setNewCollectionTitle] = useState("");

  const baseUri = swapped ? secondUri : firstUri;
  const pipUri = swapped ? firstUri : secondUri;

  const highlightsQuery = useQuery({
    queryKey: ["story-highlights", user?.id],
    queryFn: () => getHighlights(user!.id),
    enabled: !!user && sheetOpen,
  });

  const captureFirst = async () => {
    if (capturing || !cameraReady) return;
    setCapturing(true);
    setCaptureError(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: PHOTO_QUALITY,
      });
      if (!photo?.uri) throw new Error("no photo");
      setFirstUri(photo.uri);
      setFacing(opposite(primaryFacing));
      setCountdown(COUNTDOWN_TICKS);
      setPhase("countdown");
    } catch {
      setCaptureError("The photo could not be taken. Try again.");
    } finally {
      setCapturing(false);
    }
  };

  // Countdown drives itself down to zero, then fires the second shot. The
  // ticks double as time for the flipped camera to finish initializing.
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown > 0) {
      const timer = setTimeout(
        () => setCountdown((c) => c - 1),
        COUNTDOWN_TICK_MS,
      );
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    (async () => {
      try {
        const photo = await cameraRef.current?.takePictureAsync({
          quality: PHOTO_QUALITY,
        });
        if (cancelled) return;
        if (!photo?.uri) throw new Error("no photo");
        setSecondUri(photo.uri);
        setPhase("preview");
      } catch {
        if (cancelled) return;
        setCaptureError("The second photo failed. Try again.");
        setFirstUri(null);
        setFacing(primaryFacing);
        setPhase("first");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, countdown, primaryFacing]);

  const retake = () => {
    setFirstUri(null);
    setSecondUri(null);
    setSwapped(false);
    setSheetOpen(false);
    setCaptureError(null);
    shareMutation.reset();
    setFacing(primaryFacing);
    setCountdown(COUNTDOWN_TICKS);
    setPhase("first");
  };

  const togglePrimary = () => {
    const next = opposite(primaryFacing);
    setPrimaryFacing(next);
    setFacing(next);
  };

  const shareMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You need to be signed in to share a moment.");
      if (!baseUri || !pipUri) throw new Error("Take both photos first.");

      const mediaUrl = await uploadStoryMedia(user.id, baseUri, "image/jpeg");
      const selfieUrl = await uploadStoryMedia(user.id, pipUri, "image/jpeg");

      const story = await createStory(user.id, mediaUrl, visibility, {
        mediaType: "image",
        interactiveData: {
          stickers: [],
          selfie: { url: selfieUrl, position: SELFIE_CORNER },
        },
      });

      // The moment exists either way; a failed collection save should not
      // fail the share or invite a duplicate story on retry.
      try {
        if (collection.kind === "existing") {
          await addStoriesToHighlight(collection.id, [story.id]);
        } else if (collection.kind === "new" && newCollectionTitle.trim()) {
          await createHighlight(newCollectionTitle.trim(), [story.id]);
        }
      } catch {
        Alert.alert(
          "Moment shared",
          "It could not be added to the collection. You can add it later from your profile.",
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      if (collection.kind !== "none") {
        queryClient.invalidateQueries({ queryKey: ["story-highlights"] });
      }
      safeBack(router);
    },
  });

  const savingToNewCollection =
    collection.kind === "new" && !newCollectionTitle.trim();
  const canShare = !shareMutation.isPending && !savingToNewCollection;

  // Null while the OS is still resolving permission state.
  if (!permission) {
    return <View style={styles.fill} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.permissionWrap]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close camera"
          onPress={() => safeBack(router)}
          hitSlop={12}
          style={[
            styles.chromeButton,
            styles.closeButton,
            { top: insets.top + spacing(3) },
          ]}
        >
          <Ionicons name="close" size={24} color={CHROME_TEXT} />
        </Pressable>
        <Ionicons
          name="camera-outline"
          size={44}
          color={colors.mutedForeground}
        />
        <Text style={styles.permissionTitle}>Camera</Text>
        <Text style={styles.permissionBody}>
          Moments capture both sides at once: the back camera first, then a
          quick selfie. Orbit needs the camera to take them.
        </Text>
        {permission.canAskAgain ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Allow camera"
            onPress={requestPermission}
            style={({ pressed }) => [
              styles.permissionButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.permissionButtonLabel}>Allow access</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => Linking.openSettings()}
            style={({ pressed }) => [
              styles.permissionButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.permissionButtonLabel}>Open settings</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {phase !== "preview" ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          mode="picture"
          facing={facing}
          onCameraReady={() => setCameraReady(true)}
        />
      ) : baseUri ? (
        <>
          <Image
            source={{ uri: baseUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            alt="Moment preview"
          />
          {pipUri ? (
            <StoryOverlayLayer
              textOverlay={null}
              stickers={[]}
              selfie={{ url: pipUri, position: SELFIE_CORNER }}
              onSelfiePress={() => setSwapped((s) => !s)}
            />
          ) : null}
        </>
      ) : null}

      {phase === "countdown" ? (
        <View pointerEvents="none" style={styles.countdownWrap}>
          <View style={styles.countdownChip}>
            <Text style={styles.countdownLabel}>Get ready</Text>
            <Text style={styles.countdownNumber}>
              {Math.max(countdown, 1)}
            </Text>
          </View>
        </View>
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
        <View style={styles.topBarSpacer} />
        {phase === "first" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              primaryFacing === "back"
                ? "Shoot the selfie first"
                : "Shoot the back camera first"
            }
            onPress={togglePrimary}
            disabled={capturing}
            hitSlop={12}
            style={({ pressed }) => [
              styles.chromeButton,
              pressed && { opacity: 0.7 },
              capturing && { opacity: 0.4 },
            ]}
          >
            <Ionicons name="camera-reverse-outline" size={24} color={CHROME_TEXT} />
          </Pressable>
        ) : null}
      </View>

      {phase === "first" ? (
        <View style={[styles.captureControls, { bottom: insets.bottom + spacing(8) }]}>
          {captureError ? (
            <Text style={styles.captureErrorLabel}>{captureError}</Text>
          ) : (
            <Text style={styles.captureHint}>
              {primaryFacing === "back"
                ? "Back camera first, then your selfie"
                : "Selfie first, then the back camera"}
            </Text>
          )}
          <View style={styles.shutterRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pick from your gallery instead"
              onPress={() => router.replace("/create-story")}
              hitSlop={8}
              style={({ pressed }) => [
                styles.chromeButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="images-outline" size={22} color={CHROME_TEXT} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take the moment"
              onPress={captureFirst}
              disabled={!cameraReady || capturing}
              style={[
                styles.shutterRing,
                (!cameraReady || capturing) && { opacity: 0.4 },
              ]}
            >
              <View style={styles.shutterCore} />
            </Pressable>
            {/* Mirrors the gallery button so the shutter stays centered. */}
            <View style={styles.shutterSideSpacer} />
          </View>
        </View>
      ) : null}

      {phase === "preview" && !sheetOpen ? (
        <View style={[styles.previewControls, { bottom: insets.bottom + spacing(8) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retake both photos"
            onPress={retake}
            style={({ pressed }) => [styles.previewButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="refresh-outline" size={18} color={CHROME_TEXT} />
            <Text style={styles.previewButtonLabel}>Retake</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose who sees it and share"
            onPress={() => setSheetOpen(true)}
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

      {phase === "preview" && sheetOpen ? (
        <View style={styles.sheetOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to preview"
            style={styles.sheetBackdrop}
            onPress={() => setSheetOpen(false)}
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing(4) }]}>
            <Text style={styles.sheetTitle}>Share your moment</Text>

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
                  color={
                    visibility === "public"
                      ? colors.primaryForeground
                      : colors.textSecondary
                  }
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
                    visibility === "close_friends" &&
                      styles.visibilityChipLabelActive,
                  ]}
                >
                  Close friends
                </Text>
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Save to collection (optional)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.collectionRow}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Do not save to a collection"
                onPress={() => setCollection({ kind: "none" })}
                style={[
                  styles.collectionChip,
                  collection.kind === "none" && styles.collectionChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.collectionChipLabel,
                    collection.kind === "none" && styles.collectionChipLabelActive,
                  ]}
                >
                  None
                </Text>
              </Pressable>
              {(highlightsQuery.data ?? []).map((highlight) => {
                const active =
                  collection.kind === "existing" && collection.id === highlight.id;
                return (
                  <Pressable
                    key={highlight.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Save to ${highlight.title}`}
                    onPress={() =>
                      setCollection({
                        kind: "existing",
                        id: highlight.id,
                        title: highlight.title,
                      })
                    }
                    style={[
                      styles.collectionChip,
                      active && styles.collectionChipActive,
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.collectionChipLabel,
                        active && styles.collectionChipLabelActive,
                      ]}
                    >
                      {highlight.title}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save to a new collection"
                onPress={() => setCollection({ kind: "new" })}
                style={[
                  styles.collectionChip,
                  collection.kind === "new" && styles.collectionChipActive,
                ]}
              >
                <Ionicons
                  name="add"
                  size={14}
                  color={
                    collection.kind === "new"
                      ? colors.primaryForeground
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.collectionChipLabel,
                    collection.kind === "new" && styles.collectionChipLabelActive,
                  ]}
                >
                  New collection
                </Text>
              </Pressable>
            </ScrollView>
            {collection.kind === "new" ? (
              <Field
                placeholder="Collection name"
                value={newCollectionTitle}
                onChangeText={setNewCollectionTitle}
                maxLength={MAX_COLLECTION_TITLE_LENGTH}
                autoFocus
              />
            ) : null}

            {shareMutation.error ? (
              <Text style={styles.error}>
                {shareMutation.error instanceof Error
                  ? shareMutation.error.message
                  : "The moment could not be shared."}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share moment"
              disabled={!canShare}
              onPress={() => shareMutation.mutate()}
              style={({ pressed }) => [
                styles.shareButton,
                pressed && { opacity: 0.85 },
                !canShare && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.shareButtonLabel}>
                {shareMutation.isPending ? "Sharing" : "Share"}
              </Text>
            </Pressable>
          </View>
        </View>
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
  },
  topBarSpacer: {
    flex: 1,
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
  countdownWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  countdownChip: {
    alignItems: "center",
    gap: spacing(1),
    borderRadius: radii.lg,
    backgroundColor: CHROME_SCRIM,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CHROME_HAIRLINE,
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(4),
  },
  countdownLabel: {
    color: CHROME_TEXT,
    fontSize: 14.5,
    fontWeight: "600",
  },
  countdownNumber: {
    color: colors.primary,
    fontSize: 40,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  captureControls: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: spacing(4),
  },
  captureHint: {
    color: CHROME_TEXT,
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.9,
  },
  captureErrorLabel: {
    color: colors.destructive,
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
    borderRadius: radii.full,
    backgroundColor: CHROME_SCRIM,
    overflow: "hidden",
  },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(8),
  },
  shutterSideSpacer: {
    width: 44,
    height: 44,
  },
  shutterRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: CHROME_TEXT,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
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
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    gap: spacing(3),
  },
  sheetTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
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
  sectionLabel: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    fontWeight: "600",
  },
  collectionRow: {
    gap: spacing(2),
  },
  collectionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
    paddingHorizontal: spacing(3),
    minHeight: 32,
    maxWidth: 180,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
  },
  collectionChipActive: {
    backgroundColor: colors.primary,
  },
  collectionChipLabel: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontWeight: "600",
  },
  collectionChipLabelActive: {
    color: colors.primaryForeground,
  },
  shareButton: {
    minHeight: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButtonLabel: {
    color: colors.primaryForeground,
    fontSize: 14.5,
    fontWeight: "700",
  },
  error: {
    color: colors.destructive,
    fontSize: 13,
  },
});
