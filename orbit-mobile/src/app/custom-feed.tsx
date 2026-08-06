import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Field } from "@/components/ui";
import {
  createCustomFeed,
  deleteCustomFeed,
  getCustomFeeds,
  updateCustomFeed,
} from "@/lib/queries/custom-feeds";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const NAME_MAX_LENGTH = 30;

/**
 * Builds or edits a custom feed.
 *
 * Hashtags and keywords are entered as comma-separated lists rather than
 * chips-with-a-picker: the entry is one field each, everything is visible at
 * once, and editing a mistake is a text edit rather than a hunt for the
 * right chip to delete.
 */
export default function CustomFeedScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const feedsQuery = useQuery({
    queryKey: ["custom-feeds", user?.id],
    queryFn: () => getCustomFeeds(user!.id),
    enabled: !!user,
  });
  const existing = feedsQuery.data?.find((feed) => feed.id === id);

  const [name, setName] = useState<string | null>(null);
  const [hashtags, setHashtags] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string | null>(null);
  const [followingOnly, setFollowingOnly] = useState<boolean | null>(null);
  const [mediaOnly, setMediaOnly] = useState<"image" | "video" | null | undefined>(
    undefined,
  );

  // Seeded lazily from the loaded feed so a refetch cannot clobber an edit
  // in progress.
  const nameValue = name ?? existing?.name ?? "";
  const hashtagsValue = hashtags ?? existing?.hashtags.join(", ") ?? "";
  const keywordsValue = keywords ?? existing?.keywords.join(", ") ?? "";
  const followingValue = followingOnly ?? existing?.following_only ?? false;
  const mediaValue =
    mediaOnly === undefined ? (existing?.media_only ?? null) : mediaOnly;

  const asList = (raw: string) => raw.split(",").map((part) => part.trim());
  const input = {
    name: nameValue,
    hashtags: asList(hashtagsValue),
    keywords: asList(keywordsValue),
    followingOnly: followingValue,
    mediaOnly: mediaValue,
  };

  // The table refuses a feed with neither, because one that matches
  // everything is the main feed under another name.
  const hasRule =
    input.hashtags.some(Boolean) || input.keywords.some(Boolean);
  const canSave = nameValue.trim().length > 0 && hasRule;

  const save = useMutation({
    mutationFn: () =>
      id && existing
        ? updateCustomFeed(id, input)
        : createCustomFeed(user!.id, input).then(() => undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-feeds"] });
      router.back();
    },
    onError: (err: unknown) =>
      Alert.alert(
        err instanceof Error && /duplicate|unique/i.test(err.message)
          ? "You already have a feed with that name"
          : "Couldn't save this feed",
      ),
  });

  const remove = useMutation({
    mutationFn: () => deleteCustomFeed(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-feeds"] });
      router.back();
    },
    onError: () => Alert.alert("Couldn't delete this feed"),
  });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: existing ? "Edit feed" : "New feed",
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save feed"
              disabled={!canSave || save.isPending}
              onPress={() => save.mutate()}
              hitSlop={8}
              style={({ pressed }) => [
                pressed && { opacity: 0.7 },
                (!canSave || save.isPending) && { opacity: 0.4 },
              ]}
            >
              <Text style={styles.save}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <Field
            value={nameValue}
            onChangeText={setName}
            placeholder="Cars, plants, local news"
            maxLength={NAME_MAX_LENGTH}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Hashtags</Text>
          <Field
            value={hashtagsValue}
            onChangeText={setHashtags}
            placeholder="carguy, stance, jdm"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.hint}>
            Separate with commas. The # is optional.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Keywords</Text>
          <Field
            value={keywordsValue}
            onChangeText={setKeywords}
            placeholder="car meet, track day"
            autoCapitalize="none"
          />
          <Text style={styles.hint}>
            A post matches if it has any of the hashtags or any of the
            keywords.
          </Text>
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.label}>Only people I follow</Text>
            <Text style={styles.hint}>
              Off means anyone on Orbit who matches.
            </Text>
          </View>
          <Switch
            value={followingValue}
            onValueChange={setFollowingOnly}
            trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
            thumbColor={colors.foreground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Media</Text>
          <View style={styles.mediaRow}>
            {(
              [
                { value: null, label: "Anything" },
                { value: "image" as const, label: "Photos" },
                { value: "video" as const, label: "Video" },
              ] satisfies { value: "image" | "video" | null; label: string }[]
            ).map((option) => {
              const active = mediaValue === option.value;
              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setMediaOnly(option.value)}
                  style={({ pressed }) => [
                    styles.mediaChip,
                    active && styles.mediaChipActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.mediaChipLabel,
                      active && styles.mediaChipLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.explainer}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.mutedForeground}
          />
          <Text style={styles.explainerText}>
            Custom feeds are newest first. Nothing is reordered: you said what
            you want to see, so this shows it in the order it happened.
          </Text>
        </View>

        {existing ? (
          <View style={styles.dangerZone}>
            <Button
              label={remove.isPending ? "Deleting" : "Delete this feed"}
              variant="destructive"
              loading={remove.isPending}
              onPress={() =>
                Alert.alert(`Delete ${existing.name}?`, "The posts are not affected.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => remove.mutate(),
                  },
                ])
              }
            />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing(4),
    gap: spacing(5),
    paddingBottom: spacing(10),
  },
  save: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: spacing(4),
  },
  field: {
    gap: spacing(2),
  },
  label: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "700",
  },
  hint: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    lineHeight: 17,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(4),
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  mediaRow: {
    flexDirection: "row",
    gap: spacing(2),
  },
  mediaChip: {
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  mediaChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  mediaChipLabel: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "600",
  },
  mediaChipLabelActive: {
    color: colors.primaryForeground,
  },
  explainer: {
    flexDirection: "row",
    gap: spacing(2.5),
    padding: spacing(3),
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  explainerText: {
    flex: 1,
    color: colors.mutedForeground,
    fontSize: 12.5,
    lineHeight: 18,
  },
  dangerZone: {
    paddingTop: spacing(4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
