import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Centered, Field } from "@/components/ui";
import {
  getContentPreferences,
  getSensitiveContentLevel,
  normalizeTopic,
  removeTopicPreference,
  setSensitiveContentLevel,
  setTopicPreference,
  type ContentPreference,
  type SensitiveContentLevel,
  type TopicPreference,
} from "@/lib/queries/content-preferences";
import {
  REMINDER_OPTIONS,
  useTimeOnOrbitStats,
} from "@/lib/hooks/use-time-on-orbit";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const SENSITIVE_OPTIONS: {
  value: SensitiveContentLevel;
  label: string;
  hint: string;
}[] = [
  { value: "less", label: "Less", hint: "Filter more aggressively." },
  { value: "standard", label: "Standard", hint: "The default balance." },
  { value: "more", label: "More", hint: "Filter as little as allowed." },
];

function RadioOptionRow({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.radioRow, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.radioDot, selected && styles.radioDotSelected]}>
        {selected ? <View style={styles.radioDotInner} /> : null}
      </View>
      <View style={styles.radioBody}>
        <Text style={styles.radioLabel}>{label}</Text>
        <Text style={styles.radioHint}>{hint}</Text>
      </View>
    </Pressable>
  );
}

function SegmentedPreference({
  value,
  onChange,
}: {
  value: TopicPreference;
  onChange: (v: TopicPreference) => void;
}) {
  return (
    <View style={styles.segment}>
      {(["see_more", "see_less"] as const).map((option) => (
        <Pressable
          key={option}
          accessibilityRole="button"
          accessibilityState={{ selected: value === option }}
          onPress={() => onChange(option)}
          style={[
            styles.segmentOption,
            value === option && styles.segmentOptionActive,
          ]}
        >
          <Text
            style={[
              styles.segmentLabel,
              value === option && styles.segmentLabelActive,
            ]}
          >
            {option === "see_more" ? "See more" : "See less"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function TimeOnOrbitSection() {
  const { todayMinutes, dailyAverageMinutes, threshold, setThreshold } =
    useTimeOnOrbitStats();

  return (
    <>
      <Text style={styles.sectionTitle}>Time on Orbit</Text>
      <View style={styles.timeStats}>
        <View style={styles.timeStat}>
          <Text style={styles.timeValue}>{todayMinutes} min</Text>
          <Text style={styles.timeCaption}>Today</Text>
        </View>
        <View style={styles.timeStat}>
          <Text style={styles.timeValue}>{dailyAverageMinutes} min</Text>
          <Text style={styles.timeCaption}>Daily average, last 7 days</Text>
        </View>
      </View>
      <Text style={styles.sectionHint}>
        One quiet heads-up per day once you pass this much time in the app.
        Stays on this device.
      </Text>
      <View style={styles.reminderRow}>
        {REMINDER_OPTIONS.map((minutes) => (
          <Pressable
            key={minutes}
            accessibilityRole="button"
            accessibilityState={{ selected: threshold === minutes }}
            onPress={() => setThreshold(minutes)}
            style={[
              styles.reminderOption,
              threshold === minutes && styles.segmentOptionActive,
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                threshold === minutes && styles.segmentLabelActive,
              ]}
            >
              {minutes === 0 ? "Off" : `${minutes} min`}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

export default function ContentSettingsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newTopic, setNewTopic] = useState("");

  const levelKey = ["sensitive-content-level", user?.id];
  const levelQuery = useQuery({
    queryKey: levelKey,
    queryFn: () => getSensitiveContentLevel(user!.id),
    enabled: !!user,
  });

  const levelMutation = useMutation({
    mutationFn: (level: SensitiveContentLevel) =>
      setSensitiveContentLevel(user!.id, level),
    onMutate: async (level) => {
      await queryClient.cancelQueries({ queryKey: levelKey });
      const previous = queryClient.getQueryData<SensitiveContentLevel>(levelKey);
      queryClient.setQueryData(levelKey, level);
      return { previous };
    },
    onError: (_error, _level, context) => {
      queryClient.setQueryData(levelKey, context?.previous);
      Alert.alert("Couldn't update sensitive content level");
    },
  });

  const prefsKey = ["content-preferences", user?.id];
  const prefsQuery = useQuery({
    queryKey: prefsKey,
    queryFn: () => getContentPreferences(user!.id),
    enabled: !!user,
  });

  const setPrefMutation = useMutation({
    mutationFn: ({ topic, preference }: ContentPreference) =>
      setTopicPreference(user!.id, topic, preference),
    onMutate: async ({ topic, preference }) => {
      await queryClient.cancelQueries({ queryKey: prefsKey });
      const previous = queryClient.getQueryData<ContentPreference[]>(prefsKey);
      queryClient.setQueryData<ContentPreference[]>(prefsKey, (list) => {
        const next = (list ?? []).filter((p) => p.topic !== topic);
        next.push({ topic, preference });
        return next.sort((a, b) => a.topic.localeCompare(b.topic));
      });
      return { previous };
    },
    onError: (_error, { topic }, context) => {
      queryClient.setQueryData(prefsKey, context?.previous);
      Alert.alert(`Couldn't save "${topic}"`);
    },
  });

  const removePrefMutation = useMutation({
    mutationFn: (topic: string) => removeTopicPreference(user!.id, topic),
    onMutate: async (topic) => {
      await queryClient.cancelQueries({ queryKey: prefsKey });
      const previous = queryClient.getQueryData<ContentPreference[]>(prefsKey);
      queryClient.setQueryData<ContentPreference[]>(prefsKey, (list) =>
        list?.filter((p) => p.topic !== topic),
      );
      return { previous };
    },
    onError: (_error, topic, context) => {
      queryClient.setQueryData(prefsKey, context?.previous);
      Alert.alert(`Couldn't remove "${topic}"`);
    },
  });

  const handleAdd = () => {
    const topic = normalizeTopic(newTopic);
    if (!topic) return;
    if (prefsQuery.data?.some((p) => p.topic === topic)) {
      Alert.alert(`"${topic}" is already in your list`);
      return;
    }
    setNewTopic("");
    setPrefMutation.mutate({ topic, preference: "see_more" });
  };

  if (!user) return null;

  if (levelQuery.isPending && prefsQuery.isPending) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Content" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </View>
    );
  }

  const preferences = prefsQuery.data ?? [];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Content" }} />

      <Text style={styles.sectionTitle}>Sensitive content</Text>
      <Text style={styles.sectionHint}>
        How much potentially sensitive content can appear in your feeds.
      </Text>
      {SENSITIVE_OPTIONS.map((option) => (
        <RadioOptionRow
          key={option.value}
          label={option.label}
          hint={option.hint}
          selected={(levelQuery.data ?? "standard") === option.value}
          onPress={() => levelMutation.mutate(option.value)}
        />
      ))}

      <Text style={styles.sectionTitle}>Topic preferences</Text>
      <Text style={styles.sectionHint}>
        Topics you add here nudge your For You ranking toward or away from
        them.
      </Text>
      {preferences.length === 0 ? (
        <Text style={styles.sectionEmpty}>No topics yet. Add one below.</Text>
      ) : (
        preferences.map((pref) => (
          <View key={pref.topic} style={styles.topicRow}>
            <Text style={styles.topicName} numberOfLines={1}>
              {pref.topic}
            </Text>
            <SegmentedPreference
              value={pref.preference}
              onChange={(preference) =>
                setPrefMutation.mutate({ topic: pref.topic, preference })
              }
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${pref.topic}`}
              onPress={() => removePrefMutation.mutate(pref.topic)}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="close" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ))
      )}
      <View style={styles.addRow}>
        <View style={styles.addField}>
          <Field
            value={newTopic}
            onChangeText={setNewTopic}
            placeholder="Add a topic, like photography"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
        </View>
        <Button
          label="Add"
          variant="outline"
          onPress={handleAdd}
          disabled={!newTopic.trim()}
          style={styles.addButton}
        />
      </View>

      <TimeOnOrbitSection />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingVertical: spacing(2),
    paddingBottom: spacing(10),
  },
  sectionTitle: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    paddingBottom: spacing(1),
  },
  sectionHint: {
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(2),
  },
  sectionEmpty: {
    color: colors.mutedForeground,
    fontSize: 13,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotSelected: {
    borderColor: colors.primary,
  },
  radioDotInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
  },
  radioBody: {
    flex: 1,
    minWidth: 0,
  },
  radioLabel: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  radioHint: {
    marginTop: 1,
    color: colors.mutedForeground,
    fontSize: 12,
  },
  topicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  topicName: {
    flex: 1,
    minWidth: 0,
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  segment: {
    flexDirection: "row",
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  segmentOption: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    backgroundColor: colors.surface,
  },
  segmentOptionActive: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
  },
  segmentLabel: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
  },
  segmentLabelActive: {
    color: colors.primary,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing(2.5),
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
  },
  addField: {
    flex: 1,
  },
  addButton: {
    minHeight: 44,
    paddingHorizontal: spacing(4),
  },
  timeStats: {
    flexDirection: "row",
    gap: spacing(6),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  timeStat: {
    flexShrink: 1,
  },
  timeValue: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  timeCaption: {
    marginTop: 2,
    color: colors.mutedForeground,
    fontSize: 12,
  },
  reminderRow: {
    flexDirection: "row",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingTop: spacing(1),
  },
  reminderOption: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
