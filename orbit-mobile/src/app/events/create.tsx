import { useMemo, useState } from "react";
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
import { createEvent, uploadEventCover } from "@/lib/queries/events";
import { colors, radii, spacing } from "@/lib/theme";

// Dependency-free date and time entry: chips for the next two weeks plus
// hour and quarter-hour chips, instead of a native picker the SDK lacks.
const DATE_CHOICE_COUNT = 14;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = [0, 15, 30, 45];

interface PickedImage {
  uri: string;
  mimeType: string;
}

function dayLabel(date: Date, offset: number) {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function hourLabel(hour: number) {
  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

export default function CreateEventScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [dayOffset, setDayOffset] = useState<number | null>(null);
  const [hour, setHour] = useState<number | null>(null);
  const [minute, setMinute] = useState(0);
  const [cover, setCover] = useState<PickedImage | null>(null);
  // Snapshot of "now", refreshed on every date/time tap so the past-time
  // check stays honest without calling Date.now during render.
  const [clock, setClock] = useState(() => new Date());

  const dateChoices = useMemo(() => {
    return Array.from({ length: DATE_CHOICE_COUNT }, (_, offset) => {
      const date = new Date(clock.getFullYear(), clock.getMonth(), clock.getDate() + offset);
      return { offset, label: dayLabel(date, offset) };
    });
  }, [clock]);

  const startAt = useMemo(() => {
    if (dayOffset === null || hour === null) return null;
    return new Date(
      clock.getFullYear(),
      clock.getMonth(),
      clock.getDate() + dayOffset,
      hour,
      minute,
    );
  }, [clock, dayOffset, hour, minute]);

  const startInPast = !!startAt && startAt.getTime() <= clock.getTime();

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You need to be signed in to create an event.");
      if (!startAt) throw new Error("Pick a date and time.");
      const coverUrl = cover
        ? await uploadEventCover(user.id, cover.uri, cover.mimeType)
        : undefined;
      return createEvent(user.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        start_at: startAt.toISOString(),
        cover_url: coverUrl,
      });
    },
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      router.replace(`/events/${event.id}`);
    },
  });

  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCover({ uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" });
    }
  };

  const canCreate =
    title.trim().length > 0 && !!startAt && !startInPast && !createMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: "New event",
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
              accessibilityLabel="Create event"
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
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Film night, zine launch"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={120}
            autoFocus
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {dateChoices.map((choice) => {
              const active = choice.offset === dayOffset;
              return (
                <Pressable
                  key={choice.offset}
                  accessibilityRole="button"
                  onPress={() => {
                    setClock(new Date());
                    setDayOffset(choice.offset);
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    {choice.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Time</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {HOURS.map((h) => {
              const active = h === hour;
              return (
                <Pressable
                  key={h}
                  accessibilityRole="button"
                  onPress={() => {
                    setClock(new Date());
                    setHour(h);
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    {hourLabel(h)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.minuteRow}>
            {MINUTES.map((m) => {
              const active = m === minute;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  onPress={() => {
                    setClock(new Date());
                    setMinute(m);
                  }}
                  style={[styles.chip, styles.minuteChip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    :{m.toString().padStart(2, "0")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {startInPast ? (
            <Text style={styles.fieldError}>Pick a time that is still ahead of now.</Text>
          ) : startAt ? (
            <Text style={styles.fieldHint}>
              Starts{" "}
              {startAt.toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Location</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Venue or address"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={200}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Cover</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cover ? "Replace cover image" : "Add cover image"}
            onPress={pickCover}
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
                <Text style={styles.coverPlaceholderLabel}>Add a cover (optional)</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Tell people what to show up for."
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
              : "The event could not be created."}
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
  fieldHint: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  fieldError: {
    color: colors.destructive,
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
  chipRow: {
    gap: spacing(2),
    paddingVertical: spacing(0.5),
  },
  minuteRow: {
    flexDirection: "row",
    gap: spacing(2),
    marginTop: spacing(1),
  },
  chip: {
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing(3),
  },
  minuteChip: {
    flex: 1,
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
  coverPicker: {
    width: "100%",
    aspectRatio: 16 / 9,
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
  error: {
    color: colors.destructive,
    fontSize: 13,
  },
});
