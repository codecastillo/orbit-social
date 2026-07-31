import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  createCommunity,
  updateCommunity,
  uploadCommunityImage,
} from "@/lib/queries/communities";
import { colors, radii, spacing } from "@/lib/theme";

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;

interface PickedImage {
  uri: string;
  mimeType: string;
}

// Same slug rules as the web create dialog; mobile derives it from the name
// instead of exposing a second field.
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CreateCommunityScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteOnly, setInviteOnly] = useState(false);
  const [avatar, setAvatar] = useState<PickedImage | null>(null);
  const [cover, setCover] = useState<PickedImage | null>(null);

  const slug = slugify(name);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You need to be signed in to start a room.");
      const community = await createCommunity(
        name.trim(),
        slug,
        description.trim(),
        inviteOnly ? "invite" : "public",
      );

      // Images upload after create (the storage path needs the community id),
      // then get patched onto the row, same order as the web dialog.
      if (avatar || cover) {
        const [avatarUrl, coverUrl] = await Promise.all([
          avatar
            ? uploadCommunityImage(user.id, community.id, "avatar", avatar.uri, avatar.mimeType)
            : Promise.resolve(null),
          cover
            ? uploadCommunityImage(user.id, community.id, "cover", cover.uri, cover.mimeType)
            : Promise.resolve(null),
        ]);
        await updateCommunity(community.id, {
          avatarUrl: avatarUrl ?? undefined,
          coverUrl: coverUrl ?? undefined,
        });
      }

      return community;
    },
    onSuccess: (community) => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["my-communities"] });
      router.replace(`/communities/${community.slug}`);
    },
  });

  const pickImage = async (kind: "avatar" | "cover") => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      aspect: kind === "cover" ? [4, 1] : [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const picked = { uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" };
      if (kind === "avatar") setAvatar(picked);
      else setCover(picked);
    }
  };

  const canCreate = name.trim().length > 0 && slug.length > 0 && !createMutation.isPending;

  const errorMessage = (() => {
    if (!createMutation.error) return null;
    const message =
      createMutation.error instanceof Error
        ? createMutation.error.message
        : "The room could not be created.";
    // Same collision handling as the web dialog: the DB raises a
    // unique_violation and includes the index name in the message.
    if (
      message.includes("communities_name_lower_unique") ||
      /name.*already exists/i.test(message)
    ) {
      return "A room with that name already exists. Try a more specific name.";
    }
    if (message.includes("duplicate") || message.includes("unique")) {
      return "A room with that URL already exists. Try a different name.";
    }
    return message;
  })();

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: "Start a room",
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
              accessibilityLabel="Create room"
              disabled={!canCreate}
              onPress={() => createMutation.mutate()}
              style={({ pressed }) => [
                styles.actionPill,
                pressed && { opacity: 0.85 },
                !canCreate && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.actionPillLabel}>
                {createMutation.isPending ? "Creating" : "Create"}
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.lookBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cover ? "Replace cover image" : "Add cover image"}
            onPress={() => pickImage("cover")}
            style={({ pressed }) => [styles.coverPicker, pressed && { opacity: 0.85 }]}
          >
            {cover ? (
              <Image
                source={{ uri: cover.uri }}
                alt="Cover preview"
                style={styles.coverImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Ionicons name="image-outline" size={20} color={colors.mutedForeground} />
                <Text style={styles.coverPlaceholderLabel}>Add cover</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={avatar ? "Replace avatar image" : "Add avatar image"}
            onPress={() => pickImage("avatar")}
            style={({ pressed }) => [styles.avatarPicker, pressed && { opacity: 0.85 }]}
          >
            {avatar ? (
              <Image
                source={{ uri: avatar.uri }}
                alt="Avatar preview"
                style={styles.avatarImage}
                contentFit="cover"
              />
            ) : (
              <Ionicons name="camera-outline" size={20} color={colors.primaryForeground} />
            )}
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Film photographers"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={NAME_MAX_LENGTH}
            autoFocus
          />
          {slug.length > 0 ? (
            <Text style={styles.fieldHint}>orbit/s/{slug}</Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What is this room about?"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.inputMultiline]}
            maxLength={DESCRIPTION_MAX_LENGTH}
            multiline
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Invite only</Text>
            <Text style={styles.toggleHint}>
              {inviteOnly
                ? "People can only join with an invite."
                : "Anyone can find and join this room."}
            </Text>
          </View>
          <Switch
            value={inviteOnly}
            onValueChange={setInviteOnly}
            trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
            thumbColor={colors.foreground}
          />
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </ScrollView>
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
  body: {
    padding: spacing(4),
    gap: spacing(4),
  },
  lookBlock: {
    marginBottom: spacing(5),
  },
  coverPicker: {
    width: "100%",
    aspectRatio: 4 / 1,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverPlaceholder: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2),
  },
  coverPlaceholderLabel: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "600",
  },
  avatarPicker: {
    position: "absolute",
    left: spacing(3),
    bottom: -spacing(5),
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: colors.background,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  field: {
    gap: spacing(1.5),
  },
  fieldLabel: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "600",
  },
  fieldHint: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  input: {
    minHeight: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.foreground,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2.5),
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3),
  },
  toggleCopy: {
    flex: 1,
  },
  toggleTitle: {
    color: colors.foreground,
    fontSize: 13.5,
    fontWeight: "600",
  },
  toggleHint: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 2,
  },
  error: {
    color: colors.destructive,
    fontSize: 13,
  },
});
