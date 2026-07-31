import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { createPost, uploadPostMedia } from "@/lib/queries/posts";
import { colors, radii, spacing } from "@/lib/theme";

const POST_MAX_LENGTH = 500;

interface PickedImage {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
}

export default function ComposeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [image, setImage] = useState<PickedImage | null>(null);

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You need to be signed in to post.");
      let media;
      if (image) {
        const url = await uploadPostMedia(user.id, image.uri, image.mimeType);
        media = [
          {
            url,
            type: image.mimeType === "image/gif" ? ("gif" as const) : ("image" as const),
            width: image.width,
            height: image.height,
          },
        ];
      }
      return createPost(user.id, content.trim(), { media });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      router.back();
    },
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImage({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    }
  };

  const trimmed = content.trim();
  const canPost = (trimmed.length > 0 || image !== null) && !publishMutation.isPending;
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
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.fill} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="What is happening in your orbit?"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          multiline
          autoFocus
          maxLength={POST_MAX_LENGTH}
        />
        {image ? (
          <View style={[styles.preview, { aspectRatio: image.width / image.height }]}>
            <Image
              source={{ uri: image.uri }}
              alt="Attached image preview"
              style={styles.previewImage}
              contentFit="cover"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove image"
              onPress={() => setImage(null)}
              style={styles.removeImage}
              hitSlop={8}
            >
              <Ionicons name="close" size={16} color={colors.foreground} />
            </Pressable>
          </View>
        ) : null}
        {publishMutation.error ? (
          <Text style={styles.error}>
            {publishMutation.error instanceof Error
              ? publishMutation.error.message
              : "The post could not be published."}
          </Text>
        ) : null}
      </ScrollView>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Attach an image"
          onPress={pickImage}
          disabled={publishMutation.isPending}
          hitSlop={8}
        >
          <Ionicons name="image-outline" size={24} color={colors.primary} />
        </Pressable>
        <Text style={[styles.counter, remaining <= 20 && { color: colors.warning }]}>
          {remaining}
        </Text>
        <Button
          label="Post"
          loading={publishMutation.isPending}
          disabled={!canPost}
          onPress={() => publishMutation.mutate()}
          style={styles.postButton}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    padding: spacing(4),
    gap: spacing(4),
  },
  input: {
    color: colors.foreground,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 120,
    textAlignVertical: "top",
  },
  preview: {
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
    width: "100%",
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
  error: {
    color: colors.destructive,
    fontSize: 13,
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
  counter: {
    marginLeft: "auto",
    color: colors.mutedForeground,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  postButton: {
    minWidth: 88,
  },
});
