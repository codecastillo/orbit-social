import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useQuery } from "@tanstack/react-query";
import { Button, Centered, EmptyState } from "@/components/ui";
import { getMyStreamCredentials } from "@/lib/queries/live";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const WEB_STREAMING_URL = "https://orbitsocial.net/settings/streaming";

const MONO_FONT = Platform.select({ ios: "Menlo", default: "monospace" });

export default function StreamingSettingsScreen() {
  const { user } = useAuth();

  const credsQuery = useQuery({
    queryKey: ["stream-credentials", user?.id],
    queryFn: () => getMyStreamCredentials(user!.id),
    enabled: !!user,
  });

  if (!user) return null;

  if (credsQuery.isPending) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Streaming" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </View>
    );
  }

  if (credsQuery.isError) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Streaming" }} />
        <EmptyState
          title="Credentials did not load"
          description="Check your connection and try again."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => credsQuery.refetch()}
            />
          }
        />
      </View>
    );
  }

  const creds = credsQuery.data;

  if (!creds) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Streaming" }} />
        <EmptyState
          title="No broadcast credentials yet"
          description="Credentials are generated the first time you open streaming settings on the web. Set up there once, then they show here."
          action={
            <Button
              label="Open streaming settings on the web"
              onPress={() => void Linking.openURL(WEB_STREAMING_URL)}
            />
          }
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Streaming" }} />

      {creds.status === "live" ? (
        <View style={styles.liveBanner}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>You are live right now.</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Go live</Text>
      <Text style={styles.explainer}>
        Broadcasting runs through OBS, Streamlabs, or an IRL encoder for now,
        so phone-native streaming is not available yet. Point your encoder at
        the credentials below and your stream appears in the Live feed the
        moment it starts.
      </Text>

      <Text style={styles.sectionTitle}>Broadcast credentials</Text>

      <View style={styles.card}>
        <CredField label="OBS · Server URL (RTMPS)" value={creds.rtmpsUrl} />
        <CredField label="OBS · Stream Key" value={creds.streamKey} secret />
        <CredField
          label="Belabox / SRT (single URL, key embedded)"
          value={creds.srtUrl}
          secret
        />
      </View>

      <Text style={styles.warning}>
        Your stream key never expires. Don&apos;t share it. Anyone with it can
        broadcast as you. If it leaks, contact support to rotate.
      </Text>

      <Text style={styles.sectionTitle}>Stream details</Text>
      <Text style={styles.explainer}>
        Title, category, tags, and chat controls are managed on the web for
        now.
      </Text>
      <View style={styles.webLinkWrap}>
        <Button
          label="Open streaming settings on the web"
          variant="outline"
          onPress={() => void Linking.openURL(WEB_STREAMING_URL)}
        />
      </View>
    </ScrollView>
  );
}

function CredField({
  label,
  value,
  secret = false,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  const [revealed, setRevealed] = useState(!secret);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(value);
    Alert.alert("Copied");
  };

  const display = revealed ? value : "•".repeat(Math.min(value.length, 40));

  return (
    <View style={styles.credField}>
      <Text style={styles.credLabel}>{label}</Text>
      <View style={styles.credValueRow}>
        <Text style={styles.credValue} numberOfLines={1} selectable={revealed}>
          {display}
        </Text>
        {secret ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide" : "Reveal"}
            onPress={() => setRevealed((v) => !v)}
            hitSlop={8}
            style={({ pressed }) => pressed && { opacity: 0.6 }}
          >
            <Ionicons
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Copy ${label}`}
          onPress={() => void handleCopy()}
          hitSlop={8}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
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
  explainer: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(2),
  },
  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    marginHorizontal: spacing(4),
    marginTop: spacing(2),
    padding: spacing(3.5),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: `${colors.destructive}66`,
    backgroundColor: `${colors.destructive}1a`,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.destructive,
  },
  liveText: {
    color: colors.destructive,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  card: {
    marginHorizontal: spacing(4),
    marginTop: spacing(1),
    padding: spacing(4),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing(4),
  },
  credField: {
    minWidth: 0,
  },
  credLabel: {
    color: colors.mutedForeground,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing(1.5),
  },
  credValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  credValue: {
    flex: 1,
    color: colors.foreground,
    fontSize: 12.5,
    fontFamily: MONO_FONT,
  },
  warning: {
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: "italic",
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2.5),
  },
  webLinkWrap: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(1),
  },
});
