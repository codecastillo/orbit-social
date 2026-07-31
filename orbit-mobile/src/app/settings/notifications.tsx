import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
} from "@/lib/queries/settings";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

// Same five per-type toggles as the web notification settings page.
const PREF_DEFS: {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
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
    key: "follows",
    label: "New followers",
    description: "When someone follows you.",
    icon: "person-add-outline",
  },
  {
    key: "mentions",
    label: "Mentions",
    description: "When someone mentions you in a post.",
    icon: "at-outline",
  },
  {
    key: "messages",
    label: "Direct messages",
    description: "When you receive a new DM.",
    icon: "mail-outline",
  },
];

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

  function togglePref(key: keyof NotificationPrefs) {
    if (!prefs) return;
    const previous = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setLocalPrefs(next);
    saveMutation.mutate(next, {
      onError: () => {
        setLocalPrefs(previous);
        Alert.alert("Couldn't save", "Check your connection and try again.");
      },
    });
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

      {PREF_DEFS.map((pref) => (
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
});
