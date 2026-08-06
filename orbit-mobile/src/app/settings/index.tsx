import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { bugReportUrl } from "@/lib/diagnostics";
import { useAuth } from "@/providers/auth-provider";
import { colors, spacing } from "@/lib/theme";

// The legal documents and the help center live on the web app; the app links
// out rather than shipping a second copy that can drift out of date.
const WEB_HELP_URL = "https://orbitsocial.net/help";
const WEB_CONTACT_URL = "https://orbitsocial.net/contact";
const WEB_TERMS_URL = "https://orbitsocial.net/terms";
const WEB_PRIVACY_URL = "https://orbitsocial.net/privacy";
const WEB_PROMISES_URL = "https://orbitsocial.net/promises";

function SettingsRow({
  icon,
  label,
  destructive = false,
  external = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destructive?: boolean;
  external?: boolean;
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
        <Ionicons
          name={external ? "open-outline" : "chevron-forward"}
          size={16}
          color={colors.textFaint}
        />
      )}
    </Pressable>
  );
}

/** A setting the app states rather than offers, with the reason inline. */
function StaticRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <View style={styles.staticRow}>
      <Ionicons name={icon} size={20} color={colors.foreground} />
      <View style={styles.staticBody}>
        <View style={styles.staticHeader}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.staticValue}>{value}</Text>
        </View>
        <Text style={styles.staticHint}>{hint}</Text>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  // Signs out this account only. The provider clears its cached data and
  // switches to the next account on the device, or lets the AuthGate land on
  // the login screen when it was the last one.
  const { signOutActiveAccount } = useAuth();

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
          icon="key-outline"
          label="Account"
          onPress={() => router.push("/settings/account" as Href)}
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
        <SettingsRow
          icon="people-circle-outline"
          label="Close friends"
          onPress={() => router.push("/settings/close-friends" as Href)}
        />
        <SettingsRow
          icon="options-outline"
          label="Content preferences"
          onPress={() => router.push("/settings/content" as Href)}
        />
        <StaticRow
          icon="moon-outline"
          label="Appearance"
          value="Dark"
          hint="Orbit is dark-only for now, on every device and system setting."
        />
      </View>

      <Text style={styles.sectionTitle}>Safety</Text>
      <View style={styles.section}>
        <SettingsRow
          icon="key-outline"
          label="Security"
          onPress={() => router.push("/settings/security" as Href)}
        />
        <SettingsRow
          icon="filter-outline"
          label="Muted words"
          onPress={() => router.push("/settings/muted-words" as Href)}
        />
        <SettingsRow
          icon="eye-off-outline"
          label="Restricted accounts"
          onPress={() => router.push("/settings/restricted" as Href)}
        />
        <SettingsRow
          icon="shield-checkmark-outline"
          label="Account status"
          onPress={() => router.push("/settings/account-status" as Href)}
        />
        <SettingsRow
          icon="laptop-outline"
          label="Sessions"
          onPress={() => router.push("/settings/sessions" as Href)}
        />
      </View>

      <Text style={styles.sectionTitle}>Creator</Text>
      <View style={styles.section}>
        <SettingsRow
          icon="shield-checkmark-outline"
          label="Verification"
          onPress={() => router.push("/settings/verification" as Href)}
        />
        <SettingsRow
          icon="cash-outline"
          label="Monetization"
          onPress={() => router.push("/settings/monetization" as Href)}
        />
        <SettingsRow
          icon="radio-outline"
          label="Streaming"
          onPress={() => router.push("/settings/streaming" as Href)}
        />
        <SettingsRow
          icon="play-back-outline"
          label="Past streams"
          onPress={() => router.push("/live/past" as Href)}
        />
        <SettingsRow
          icon="bar-chart-outline"
          label="Creator analytics"
          onPress={() => router.push("/settings/creator" as Href)}
        />
      </View>

      <Text style={styles.sectionTitle}>Help & About</Text>
      <View style={styles.section}>
        <SettingsRow
          icon="help-circle-outline"
          label="Help center"
          external
          onPress={() => void Linking.openURL(WEB_HELP_URL)}
        />
        <SettingsRow
          icon="mail-outline"
          label="Contact support"
          external
          onPress={() => void Linking.openURL(WEB_CONTACT_URL)}
        />
        <SettingsRow
          icon="bug-outline"
          label="Report a bug"
          external
          onPress={() => void Linking.openURL(bugReportUrl())}
        />
        <SettingsRow
          icon="information-circle-outline"
          label="About"
          onPress={() => router.push("/settings/about" as Href)}
        />
      </View>

      <Text style={styles.sectionTitle}>Legal</Text>
      <View style={styles.section}>
        <SettingsRow
          icon="document-text-outline"
          label="Terms of Service"
          external
          onPress={() => void Linking.openURL(WEB_TERMS_URL)}
        />
        <SettingsRow
          icon="lock-closed-outline"
          label="Privacy Policy"
          external
          onPress={() => void Linking.openURL(WEB_PRIVACY_URL)}
        />
        <SettingsRow
          icon="ribbon-outline"
          label="Ten promises"
          external
          onPress={() => void Linking.openURL(WEB_PROMISES_URL)}
        />
      </View>

      <View style={styles.section}>
        <SettingsRow
          icon="log-out-outline"
          label="Sign out"
          destructive
          onPress={signOutActiveAccount}
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
  staticRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  staticBody: {
    flex: 1,
    minWidth: 0,
  },
  staticHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(3),
  },
  staticValue: {
    color: colors.mutedForeground,
    fontSize: 14,
  },
  staticHint: {
    marginTop: 2,
    color: colors.textFaint,
    fontSize: 12.5,
    lineHeight: 17,
  },
});
