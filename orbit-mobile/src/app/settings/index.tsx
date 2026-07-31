import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/lib/theme";

function SettingsRow({
  icon,
  label,
  destructive = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={destructive ? colors.destructive : colors.foreground}
      />
      <Text style={[styles.rowLabel, destructive && styles.rowDestructive]}>
        {label}
      </Text>
      {destructive ? null : (
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    // Drop every cached query so the next account starts clean; the
    // AuthGate redirects to the login screen once the session clears.
    queryClient.clear();
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Settings" }} />

      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.section}>
        <SettingsRow
          icon="person-outline"
          label="Edit profile"
          onPress={() => router.push("/edit-profile" as Href)}
        />
        <SettingsRow
          icon="bookmark-outline"
          label="Saved"
          onPress={() => router.push("/bookmarks" as Href)}
        />
      </View>

      <Text style={styles.sectionTitle}>Preferences</Text>
      <View style={styles.section}>
        <SettingsRow
          icon="notifications-outline"
          label="Notifications"
          onPress={() => router.push("/settings/notifications" as Href)}
        />
        <SettingsRow
          icon="lock-closed-outline"
          label="Privacy"
          onPress={() => router.push("/settings/privacy" as Href)}
        />
      </View>

      <View style={styles.section}>
        <SettingsRow
          icon="log-out-outline"
          label="Sign out"
          destructive
          onPress={handleSignOut}
        />
      </View>
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
  section: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing(2),
    marginBottom: spacing(2),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    height: 50,
  },
  rowLabel: {
    flex: 1,
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "500",
  },
  rowDestructive: {
    color: colors.destructive,
  },
});
