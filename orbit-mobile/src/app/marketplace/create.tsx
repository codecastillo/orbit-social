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
import { useAuth } from "@/providers/auth-provider";
import {
  createListing,
  LISTING_CATEGORIES,
  uploadListingImage,
} from "@/lib/queries/marketplace";
import { colors, radii, spacing } from "@/lib/theme";

const MAX_IMAGES = 4;
// "All" is the browse filter, not a real category.
const CATEGORIES = LISTING_CATEGORIES.filter((category) => category !== "All");
// Same condition set as the web create dialog.
const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];

interface PickedImage {
  uri: string;
  mimeType: string;
}

export default function CreateListingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [condition, setCondition] = useState<string>(CONDITIONS[0]);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);

  const parsedPrice = Number.parseFloat(price);
  const priceValid = Number.isFinite(parsedPrice) && parsedPrice >= 0;
  const priceError = price.length > 0 && !priceValid ? "Enter a valid price." : null;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You need to be signed in to sell.");
      const imageUrls: string[] = [];
      for (const image of images) {
        imageUrls.push(await uploadListingImage(user.id, image.uri, image.mimeType));
      }
      return createListing(user.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        price: parsedPrice,
        category,
        condition,
        imageUrls,
      });
    },
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      router.replace(`/marketplace/${listing.id}`);
    },
  });

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
        mimeType: asset.mimeType ?? "image/jpeg",
      }));
      setImages((prev) => [...prev, ...picked]);
    }
  };

  const removeImage = (uri: string) => {
    setImages((prev) => prev.filter((image) => image.uri !== uri));
  };

  const canPost = title.trim().length > 0 && priceValid && !createMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: "New listing",
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
              accessibilityLabel="Post listing"
              disabled={!canPost}
              onPress={() => createMutation.mutate()}
              style={({ pressed }) => [
                styles.actionPill,
                pressed && { opacity: 0.85 },
                !canPost && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.actionPillLabel}>
                {createMutation.isPending ? "Posting" : "Post"}
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
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Photos ({images.length}/{MAX_IMAGES})
          </Text>
          <View style={styles.photoRow}>
            {images.map((image) => (
              <View key={image.uri} style={styles.photo}>
                <Image
                  source={{ uri: image.uri }}
                  alt="Listing photo preview"
                  style={styles.photoImage}
                  contentFit="cover"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  onPress={() => removeImage(image.uri)}
                  disabled={createMutation.isPending}
                  style={({ pressed }) => [styles.removePhoto, pressed && { opacity: 0.7 }]}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={14} color={colors.foreground} />
                </Pressable>
              </View>
            ))}
            {images.length < MAX_IMAGES ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add photos"
                onPress={pickImages}
                disabled={createMutation.isPending}
                style={({ pressed }) => [styles.addPhoto, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="image-outline" size={22} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What are you selling?"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={120}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Price</Text>
          <View style={styles.priceWrap}>
            <Text style={styles.priceCurrency}>$</Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              placeholderTextColor={colors.textFaint}
              style={styles.priceInput}
              keyboardType="decimal-pad"
              maxLength={10}
            />
          </View>
          {priceError ? <Text style={styles.fieldError}>{priceError}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.chipWrap}>
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  onPress={() => setCategory(c)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Condition</Text>
          <View style={styles.chipWrap}>
            {CONDITIONS.map((c) => {
              const active = c === condition;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  onPress={() => setCondition(c)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Condition details, dimensions, pickup or shipping."
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.inputMultiline]}
            maxLength={1000}
            multiline
          />
        </View>

        {createMutation.error ? (
          <Text style={styles.error}>
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : "The listing could not be posted."}
          </Text>
        ) : null}
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
    paddingBottom: spacing(10),
  },
  field: {
    gap: spacing(1.5),
  },
  fieldLabel: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "600",
  },
  fieldError: {
    color: colors.destructive,
    fontSize: 12,
  },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(2),
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: radii.sm,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  removePhoto: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(11, 11, 13, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhoto: {
    width: 80,
    height: 80,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
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
  priceWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(3.5),
  },
  priceCurrency: {
    color: colors.mutedForeground,
    fontSize: 14,
    fontWeight: "600",
    marginRight: spacing(1.5),
  },
  priceInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 14,
    paddingVertical: spacing(2.5),
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(2),
  },
  chip: {
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing(3),
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
