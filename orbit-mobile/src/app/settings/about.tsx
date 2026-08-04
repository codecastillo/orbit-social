import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Button } from "@/components/ui";
import {
  bugReportUrl,
  deviceLabel,
  diagnosticsText,
  expoSdkVersion,
  osLabel,
  runtimeVersion,
  SUPPORT_EMAIL,
  versionLabel,
} from "@/lib/diagnostics";
import { colors, radii, spacing } from "@/lib/theme";

const WEB_HELP_URL = "https://orbitsocial.net/help";
const WEB_CONTACT_URL = "https://orbitsocial.net/contact";
const WEB_TERMS_URL = "https://orbitsocial.net/terms";
const WEB_PRIVACY_URL = "https://orbitsocial.net/privacy";
const WEB_PROMISES_URL = "https://orbitsocial.net/promises";

const WEB_LINKS: { label: string; url: string }[] = [
  { label: "Help center", url: WEB_HELP_URL },
  { label: "Contact and support", url: WEB_CONTACT_URL },
  { label: "Terms of Service", url: WEB_TERMS_URL },
  { label: "Privacy Policy", url: WEB_PRIVACY_URL },
  { label: "Ten promises", url: WEB_PROMISES_URL },
];

function FactRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last: boolean;
}) {
  return (
    <View style={[styles.factRow, last && styles.rowLast]}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function LinkRow({
  label,
  url,
  last,
}: {
  label: string;
  url: string;
  last: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => [
        styles.linkRow,
        last && styles.rowLast,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="open-outline" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

export default function AboutScreen() {
  const facts: { label: string; value: string }[] = [
    { label: "Version", value: versionLabel },
    { label: "Expo SDK", value: expoSdkVersion },
    ...(runtimeVersion ? [{ label: "Runtime", value: runtimeVersion }] : []),
    { label: "System", value: osLabel() },
    { label: "Device", value: deviceLabel() },
  ];

  const handleCopyDiagnostics = async () => {
    await Clipboard.setStringAsync(diagnosticsText());
    Alert.alert(
      "Diagnostics copied",
      "Paste this into your bug report so we know which build you were on.",
    );
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "About" }} />

      <View style={styles.header}>
        <Text style={styles.appName}>Orbit</Text>
        <Text style={styles.appVersion}>{versionLabel}</Text>
      </View>

      <Text style={styles.sectionTitle}>Build</Text>
      <View style={styles.card}>
        {facts.map((fact, i) => (
          <FactRow
            key={fact.label}
            label={fact.label}
            value={fact.value}
            last={i === facts.length - 1}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          label="Copy diagnostics"
          variant="outline"
          onPress={handleCopyDiagnostics}
        />
        <Text style={styles.actionHint}>
          Copies the version, system, and device above. Attach it to a bug
          report so we can reproduce it on the same build.
        </Text>
        <Button
          label="Report a bug"
          variant="outline"
          onPress={() => void Linking.openURL(bugReportUrl())}
        />
        <Text style={styles.actionHint}>
          Opens an email to {SUPPORT_EMAIL} with the diagnostics already in the
          body.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>On the web</Text>
      <View style={styles.card}>
        {WEB_LINKS.map((link, i) => (
          <LinkRow
            key={link.url}
            label={link.label}
            url={link.url}
            last={i === WEB_LINKS.length - 1}
          />
        ))}
      </View>

      <Text style={styles.legalNote}>© 2026 Orbit Labs LLC</Text>
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
  header: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    paddingBottom: spacing(1),
  },
  appName: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  appVersion: {
    marginTop: 2,
    color: colors.mutedForeground,
    fontSize: 14,
  },
  sectionTitle: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(5),
    paddingBottom: spacing(2),
  },
  card: {
    marginHorizontal: spacing(4),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(3.5),
  },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(4),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  factLabel: {
    color: colors.mutedForeground,
    fontSize: 13.5,
  },
  factValue: {
    flexShrink: 1,
    color: colors.foreground,
    fontSize: 13.5,
    fontWeight: "600",
    textAlign: "right",
  },
  actions: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    gap: spacing(2),
  },
  actionHint: {
    color: colors.textFaint,
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: spacing(2),
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing(3.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  linkLabel: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "500",
  },
  legalNote: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(6),
    color: colors.textFaint,
    fontSize: 12,
  },
});
