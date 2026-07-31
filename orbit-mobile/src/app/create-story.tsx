import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  createStory,
  uploadStoryMedia,
  type StoryVisibility,
} from "@/lib/queries/stories";
import { colors, radii, spacing } from "@/lib/theme";

interface PickedImage {
  uri: string;
  mimeType: string;
}

export default function CreateStoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [image, setImage] = useState<PickedImage | null>(null);
  const [visibility, setVisibility] = useState<StoryVisibility>("public");

  const shareMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You need to be signed in to share a moment.");
      if (!image) throw new Error("Pick a photo first.");
      const url = await uploadStoryMedia(user.id, image.uri, image.mimeType);
      return createStory(user.id, url, visibility);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
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
      setImage({ uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" });
    }
  };

  const canShare = !!image && !shareMutation.isPending;

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
      {image ? (
        <View style={styles.previewWrap}>
          <Image
            source={{ uri: image.uri }}
            alt="Moment preview"
            style={styles.preview}
            contentFit="contain"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change photo"
            onPress={pickImage}
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
          accessibilityLabel="Choose a photo"
          onPress={pickImage}
          style={({ pressed }) => [styles.picker, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="image-outline" size={40} color={colors.mutedForeground} />
          <Text style={styles.pickerLabel}>Choose a photo</Text>
          <Text style={styles.pickerHint}>Moments disappear after 24 hours</Text>
        </Pressable>
      )}
      <View style={styles.footer}>
        <View style={styles.visibilityRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setVisibility("public")}
            style={[styles.chip, visibility === "public" && styles.chipActive]}
          >
            <Ionicons
              name="earth"
              size={14}
              color={visibility === "public" ? colors.primaryForeground : colors.textSecondary}
            />
            <Text
              style={[styles.chipLabel, visibility === "public" && styles.chipLabelActive]}
            >
              Public
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setVisibility("close_friends")}
            style={[styles.chip, visibility === "close_friends" && styles.chipActive]}
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
                styles.chipLabel,
                visibility === "close_friends" && styles.chipLabelActive,
              ]}
            >
              Close friends
            </Text>
          </Pressable>
        </View>
        {shareMutation.error ? (
          <Text style={styles.error}>
            {shareMutation.error instanceof Error
              ? shareMutation.error.message
              : "The moment could not be shared."}
          </Text>
        ) : null}
      </View>
    </View>
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
    flex: 1,
    margin: spacing(4),
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  preview: {
    flex: 1,
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
    flex: 1,
    margin: spacing(4),
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2),
  },
  pickerLabel: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  pickerHint: {
    color: colors.mutedForeground,
    fontSize: 12.5,
  },
  footer: {
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(6),
    gap: spacing(3),
  },
  visibilityRow: {
    flexDirection: "row",
    gap: spacing(2),
  },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(1.5),
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  chipLabelActive: {
    color: colors.primaryForeground,
  },
  error: {
    color: colors.destructive,
    fontSize: 13,
  },
});
