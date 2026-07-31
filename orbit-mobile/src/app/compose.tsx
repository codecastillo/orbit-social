import { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui";
import {
  MentionButton,
  MentionInput,
  type MentionInputHandle,
} from "@/components/mention-input";
import { useAuth } from "@/providers/auth-provider";
import { createPost, uploadPostMedia, type NewPostMedia } from "@/lib/queries/posts";
import { getOwnProfile } from "@/lib/queries/profiles";
import { scheduleUndoableSend } from "@/lib/undo-send";
import { colors, radii, spacing } from "@/lib/theme";

const POST_MAX_LENGTH = 500;
const MAX_IMAGES = 4; // Same attachment cap as the web composer.
const COUNTER_WARN_THRESHOLD = 20;

interface PickedImage {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
}

// Stashed when an undoable publish is cancelled after this modal already
// closed; the next mount consumes it so the user gets their draft back.
// Module scope because the screen unmounts on router.back().
let undoRestore: { content: string; images: PickedImage[] } | null = null;

export default function ComposeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  // Seed from a stashed undo snapshot when a cancelled publish reopened
  // this modal; cleared after mount so the next compose starts blank.
  const [restore] = useState(() => undoRestore);
  useEffect(() => {
    undoRestore = null;
  }, []);
  const [content, setContent] = useState(restore?.content ?? "");
  const [images, setImages] = useState<PickedImage[]>(restore?.images ?? []);
  const captionRef = useRef<MentionInputHandle>(null);

  // Own avatar beside the caption input; shares the profile cache key used
  // by the profile and edit screens.
  const { data: ownProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getOwnProfile(user!.id),
    enabled: !!user,
  });

  // Delayed commit: dismiss the modal right away and give the snackbar a
  // 5 second undo window before the upload and insert actually run.
  const handlePublish = () => {
    if (!user) return;
    const snapshot = { content, images };

    const publish = async () => {
      try {
        let media: NewPostMedia[] | undefined;
        if (snapshot.images.length > 0) {
          media = await Promise.all(
            snapshot.images.map(async (img) => ({
              url: await uploadPostMedia(user.id, img.uri, img.mimeType),
              type: img.mimeType === "image/gif" ? ("gif" as const) : ("image" as const),
              width: img.width,
              height: img.height,
            })),
          );
        }
        await createPost(user.id, snapshot.content.trim(), { media });
        queryClient.invalidateQueries({ queryKey: ["feed"] });
      } catch (err) {
        // The screen is gone by the time the commit runs, so surface the
        // failure globally instead of the old inline error text.
        Alert.alert(
          "Post not published",
          err instanceof Error ? err.message : "The post could not be published.",
        );
      }
    };

    router.back();
    scheduleUndoableSend({
      message: "Posted",
      commit: () => void publish(),
      onUndo: () => {
        undoRestore = snapshot;
        router.push("/compose");
      },
    });
  };

  const pickImages = async () => {
    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
    });
    if (!result.canceled && result.assets.length > 0) {
      const picked = result.assets.slice(0, remainingSlots).map((asset) => ({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        mimeType: asset.mimeType ?? "image/jpeg",
      }));
      setImages((prev) => [...prev, ...picked]);
    }
  };

  const removeImage = (uri: string) => {
    setImages((prev) => prev.filter((img) => img.uri !== uri));
  };

  const trimmed = content.trim();
  const canPost = trimmed.length > 0 || images.length > 0;
  const remaining = POST_MAX_LENGTH - content.length;

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: "New post",
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
              accessibilityLabel="Publish post"
              disabled={!canPost}
              onPress={handlePublish}
              style={({ pressed }) => [
                styles.postPill,
                pressed && { opacity: 0.85 },
                !canPost && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.postPillLabel}>Post</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.fill} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.inputRow}>
          <Avatar
            url={ownProfile?.avatar_url}
            name={ownProfile?.display_name || ownProfile?.username || "You"}
            size={36}
          />
          <MentionInput
            ref={captionRef}
            value={content}
            onChangeText={setContent}
            placeholder="What is happening in your orbit?"
            placeholderTextColor={colors.textFaint}
            containerStyle={styles.inputWrap}
            style={styles.input}
            panelPlacement="below"
            multiline
            autoFocus
            maxLength={POST_MAX_LENGTH}
          />
        </View>
        {images.length > 0 ? (
          <View style={styles.previewGrid}>
            {images.map((img) => (
              <View
                key={img.uri}
                style={[styles.preview, images.length === 1 && styles.previewSingle]}
              >
                <Image
                  source={{ uri: img.uri }}
                  alt="Attached image preview"
                  style={styles.previewImage}
                  contentFit="cover"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove image"
                  onPress={() => removeImage(img.uri)}
                  style={({ pressed }) => [styles.removeImage, pressed && { opacity: 0.7 }]}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={16} color={colors.foreground} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Attach images"
          onPress={pickImages}
          disabled={images.length >= MAX_IMAGES}
          style={({ pressed }) => [
            pressed && { opacity: 0.7 },
            images.length >= MAX_IMAGES && { opacity: 0.4 },
          ]}
          hitSlop={8}
        >
          <Ionicons name="image-outline" size={24} color={colors.primary} />
        </Pressable>
        <MentionButton
          onPress={() => captionRef.current?.insertMentionTrigger()}
        />
        {images.length > 0 ? (
          <Text style={styles.imageCount}>
            {images.length}/{MAX_IMAGES}
          </Text>
        ) : null}
        <Text style={[styles.counter, remaining <= COUNTER_WARN_THRESHOLD && { color: colors.warning }]}>
          {remaining}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cancelLabel: {
    color: colors.foreground,
    fontSize: 15,
  },
  postPill: {
    minHeight: 32,
    paddingHorizontal: spacing(4),
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  postPillLabel: {
    color: colors.primaryForeground,
    fontSize: 13.5,
    fontWeight: "700",
  },
  body: {
    padding: spacing(4),
    gap: spacing(4),
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing(3),
  },
  inputWrap: {
    flex: 1,
  },
  input: {
    color: colors.foreground,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 120,
    paddingTop: spacing(2),
    textAlignVertical: "top",
  },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(2),
  },
  preview: {
    width: "48.5%",
    aspectRatio: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
  },
  previewSingle: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  removeImage: {
    position: "absolute",
    top: spacing(2),
    right: spacing(2),
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(4),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  imageCount: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  counter: {
    marginLeft: "auto",
    color: colors.mutedForeground,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
});
