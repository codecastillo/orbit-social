import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Centered, EmptyState } from "@/components/ui";
import {
  getNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
  type NotificationToggleKey,
} from "@/lib/queries/settings";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

interface PrefDef {
  key: NotificationToggleKey;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// Same groups as the web notification settings page.
const PREF_GROUPS: { title: string; prefs: PrefDef[] }[] = [
  {
    title: "Interactions",
    prefs: [
      {
        key: "likes",
        label: "Likes",
        description: "When someone likes your post.",
        icon: "heart-outline",
      },
      {
        key: "comments",
        label: "Comments",
        description: "When someone comments on your post.",
        icon: "chatbubble-outline",
      },
      {
        key: "reposts",
        label: "Reposts and quotes",
        description: "When someone reposts or quotes your post.",
        icon: "repeat-outline",
      },
      {
        key: "mentions",
        label: "Mentions",
        description: "When someone mentions you in a post.",
        icon: "at-outline",
      },
      {
        key: "story_replies",
        label: "Moment replies",
        description: "When someone reacts or replies to your moment.",
        icon: "arrow-undo-outline",
      },
      {
        key: "messages",
        label: "Direct messages",
        description: "When you receive a new DM.",
        icon: "mail-outline",
      },
    ],
  },
  {
    title: "Content",
    prefs: [
      {
        key: "follows",
        label: "New followers",
        description: "When someone follows you.",
        icon: "person-add-outline",
      },
      {
        key: "new_followers_posts",
        label: "Posts from people you follow",
        description: "New posts from creators you rang the bell for.",
        icon: "newspaper-outline",
      },
    ],
  },
  {
    title: "Surfaces",
    prefs: [
      {
        key: "live_streams",
        label: "Live streams",
        description: "When someone you follow goes live.",
        icon: "radio-outline",
      },
      {
        key: "events",
        label: "Events",
        description: "Event invites and reminders.",
        icon: "calendar-outline",
      },
      {
        key: "marketplace",
        label: "Marketplace",
        description: "Activity on your listings and offers.",
        icon: "bag-outline",
      },
      {
        key: "communities",
        label: "Communities",
        description: "Room invites and community activity.",
        icon: "people-outline",
      },
    ],
  },
  {
    title: "Email",
    prefs: [
      {
        key: "email_digest",
        label: "Daily digest",
        description:
          "One email a day summing up what you missed. Account email like password resets always sends.",
        icon: "mail-open-outline",
      },
    ],
  },
];

const HOURS_PER_DAY = 24;

function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}

export default function NotificationSettingsScreen() {
  const { user } = useAuth();
  // Optimistic toggles layer over the fetched row; the server data stays
  // the source of truth until the first local change.
  const [localPrefs, setLocalPrefs] = useState<NotificationPrefs | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["notification-prefs", user?.id],
    queryFn: () => getNotificationPrefs(user!.id),
    enabled: !!user,
  });

  const prefs = localPrefs ?? data ?? null;

  const saveMutation = useMutation({
    mutationFn: (next: NotificationPrefs) =>
      saveNotificationPrefs(user!.id, next),
  });

  function updatePrefs(next: NotificationPrefs) {
    if (!prefs) return;
    const previous = prefs;
    setLocalPrefs(next);
    saveMutation.mutate(next, {
      onError: () => {
        setLocalPrefs(previous);
        Alert.alert("Couldn't save", "Check your connection and try again.");
      },
    });
  }

  function togglePref(key: NotificationToggleKey) {
    if (!prefs) return;
    updatePrefs({ ...prefs, [key]: !prefs[key] });
  }

  function shiftQuietHour(key: "quiet_hours_start" | "quiet_hours_end", delta: number) {
    if (!prefs) return;
    const next = (prefs[key] + delta + HOURS_PER_DAY) % HOURS_PER_DAY;
    updatePrefs({ ...prefs, [key]: next });
  }

  if (!user) return null;

  if (isPending || !prefs) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Notifications" }} />
        {isError ? (
          <EmptyState
            title="Settings did not load"
            description="Check your connection and try again."
            action={
              <Button
                label="Retry"
                variant="outline"
                onPress={() => refetch()}
              />
            }
          />
        ) : (
          <Centered>
            <ActivityIndicator color={colors.primary} />
          </Centered>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Notifications" }} />

      <View style={styles.note}>
        <Ionicons
          name="phone-portrait-outline"
          size={18}
          color={colors.primary}
        />
        <Text style={styles.noteText}>
          Push on this device arrives with the development build. These
          toggles choose which alerts reach you everywhere.
        </Text>
      </View>

      {PREF_GROUPS.map((group) => (
        <View key={group.title}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          {group.prefs.map((pref) => (
            <View key={pref.key} style={styles.row}>
              <View style={styles.iconTile}>
                <Ionicons name={pref.icon} size={16} color={colors.primary} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>{pref.label}</Text>
                <Text style={styles.rowDescription}>{pref.description}</Text>
              </View>
              <Switch
                accessibilityLabel={pref.label}
                value={prefs[pref.key]}
                onValueChange={() => togglePref(pref.key)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.foreground}
              />
            </View>
          ))}
        </View>
      ))}

      <Text style={styles.groupTitle}>Quiet hours</Text>
      <View style={styles.row}>
        <View style={styles.iconTile}>
          <Ionicons name="moon-outline" size={16} color={colors.primary} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>Pause push notifications</Text>
          <Text style={styles.rowDescription}>
            No pushes during this window, in your local time. Everything still
            lands in your notifications tab.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Pause push notifications"
          value={prefs.quiet_hours_enabled}
          onValueChange={() =>
            updatePrefs({
              ...prefs,
              quiet_hours_enabled: !prefs.quiet_hours_enabled,
            })
          }
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.foreground}
        />
      </View>
      {prefs.quiet_hours_enabled ? (
        <>
          <HourRow
            label="From"
            hour={prefs.quiet_hours_start}
            onShift={(delta) => shiftQuietHour("quiet_hours_start", delta)}
          />
          <HourRow
            label="Until"
            hour={prefs.quiet_hours_end}
            onShift={(delta) => shiftQuietHour("quiet_hours_end", delta)}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function HourRow({
  label,
  hour,
  onShift,
}: {
  label: string;
  hour: number;
  onShift: (delta: number) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.hourStepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: one hour earlier`}
          onPress={() => onShift(-1)}
          style={({ pressed }) => [
            styles.stepButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="chevron-back" size={16} color={colors.foreground} />
        </Pressable>
        <Text style={styles.hourValue}>{hourLabel(hour)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: one hour later`}
          onPress={() => onShift(1)}
          style={({ pressed }) => [
            styles.stepButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.foreground}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingVertical: spacing(2),
    paddingBottom: spacing(8),
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    marginHorizontal: spacing(4),
    marginVertical: spacing(2),
    padding: spacing(3),
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  noteText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
  },
  groupTitle: {
    marginTop: spacing(4),
    marginBottom: spacing(1),
    marginHorizontal: spacing(4),
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "600",
  },
  rowDescription: {
    marginTop: 2,
    color: colors.mutedForeground,
    fontSize: 12.5,
  },
  hourStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
  },
  stepButton: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  hourValue: {
    minWidth: 76,
    textAlign: "center",
    color: colors.foreground,
    fontSize: 13.5,
    fontWeight: "600",
  },
});
