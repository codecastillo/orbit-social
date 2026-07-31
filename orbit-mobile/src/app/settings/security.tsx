import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Centered } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

const WEB_SECURITY_URL = "orbitsocial.net/settings/security";

// iOS has no "monospace" alias, so pick its built-in mono face there.
const MONO_FONT = Platform.select({ ios: "Menlo", default: "monospace" });

type SetupStep = "idle" | "verifying";

export default function SecuritySettingsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const queryClient = useQueryClient();

  const [setupStep, setSetupStep] = useState<SetupStep>("idle");
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  // Resolves to the verified TOTP factor id, or null when 2FA is off.
  const factorKey = ["mfa-factor", user?.id];
  const factorQuery = useQuery({
    queryKey: factorKey,
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data.totp.find((f) => f.status === "verified")?.id ?? null;
    },
    enabled: !!user,
  });
  const verifiedFactorId = factorQuery.data ?? null;
  const mfaEnabled = !!verifiedFactorId;

  const handleCopy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert(`${label} copied`);
  };

  const handleEnroll = async () => {
    setIsEnrolling(true);
    try {
      // Abandoned setups leave an unverified factor behind, which blocks a
      // fresh enroll with the same friendly name. Clear them first.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const stale = existing?.totp.filter((f) => f.status !== "verified") ?? [];
      for (const factor of stale) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Orbit Authenticator",
      });
      if (error) throw error;
      setTotpUri(data.totp.uri);
      setTotpSecret(data.totp.secret);
      setPendingFactorId(data.id);
      setSetupStep("verifying");
    } catch (err) {
      Alert.alert(
        "Couldn't start 2FA setup",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6 || !pendingFactorId) return;
    setIsVerifying(true);
    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: pendingFactorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: pendingFactorId,
        challengeId: challenge.id,
        code: verifyCode,
      });
      if (verifyError) throw verifyError;
      queryClient.setQueryData(factorKey, pendingFactorId);
      resetSetup();
      Alert.alert("Two-factor enabled");
    } catch (err) {
      Alert.alert(
        "Invalid code",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const resetSetup = () => {
    setSetupStep("idle");
    setPendingFactorId(null);
    setTotpUri(null);
    setTotpSecret(null);
    setVerifyCode("");
  };

  const handleCancelSetup = async () => {
    // Drop the pending factor so it doesn't linger as unverified.
    if (pendingFactorId) {
      await supabase.auth.mfa.unenroll({ factorId: pendingFactorId });
    }
    resetSetup();
  };

  const handleDisable = () => {
    Alert.alert(
      "Disable two-factor?",
      "Your account will no longer ask for a code at sign-in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disable",
          style: "destructive",
          onPress: async () => {
            if (!verifiedFactorId || !user) return;
            setIsDisabling(true);
            const { error } = await supabase.auth.mfa.unenroll({
              factorId: verifiedFactorId,
            });
            if (!error) {
              // Stored recovery code hashes pair with the removed factor,
              // same cleanup as the web security page.
              await supabase
                .from("mfa_recovery_codes")
                .delete()
                .eq("user_id", user.id);
            }
            setIsDisabling(false);
            if (error) {
              Alert.alert("Couldn't disable 2FA", error.message);
              return;
            }
            queryClient.setQueryData(factorKey, null);
            resetSetup();
            Alert.alert("Two-factor disabled");
          },
        },
      ],
    );
  };

  if (!user) return null;

  if (factorQuery.isPending) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Security" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Security" }} />

      <Text style={styles.sectionTitle}>Two-factor authentication</Text>
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={styles.statusIcon}>
            <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.statusBody}>
            <Text style={styles.statusLabel}>Authenticator app</Text>
            <Text style={styles.statusHint}>
              TOTP codes from apps like 1Password, Authy, or Google
              Authenticator.
            </Text>
          </View>
          <View
            style={[styles.badge, mfaEnabled ? styles.badgeOn : styles.badgeOff]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: mfaEnabled ? colors.success : colors.mutedForeground },
              ]}
            >
              {mfaEnabled ? "ENABLED" : "OFF"}
            </Text>
          </View>
        </View>

        {setupStep === "idle" && !mfaEnabled ? (
          <Button
            label="Enable 2FA"
            loading={isEnrolling}
            onPress={() => void handleEnroll()}
          />
        ) : null}

        {mfaEnabled ? (
          <Button
            label="Disable 2FA"
            variant="destructive"
            loading={isDisabling}
            onPress={handleDisable}
          />
        ) : null}

        {setupStep === "verifying" ? (
          <View style={styles.setup}>
            <Text style={styles.stepTitle}>Step 1. Add to your authenticator</Text>
            <Text style={styles.stepHint}>
              On this phone you can&apos;t scan a QR code, so add the account
              manually. Copy the setup key (or the full otpauth link) into
              your authenticator app.
            </Text>
            {totpSecret ? (
              <CredentialBox
                label="Setup key"
                value={totpSecret}
                onCopy={() => void handleCopy(totpSecret, "Setup key")}
              />
            ) : null}
            {totpUri ? (
              <CredentialBox
                label="otpauth link"
                value={totpUri}
                onCopy={() => void handleCopy(totpUri, "Link")}
              />
            ) : null}

            <Text style={styles.stepTitle}>Step 2. Enter the 6-digit code</Text>
            <TextInput
              style={styles.codeInput}
              value={verifyCode}
              onChangeText={(value) => setVerifyCode(value.replace(/\D/g, ""))}
              placeholder="000000"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              maxLength={6}
              accessibilityLabel="6-digit code from app"
            />
            <Button
              label="Verify and enable"
              loading={isVerifying}
              disabled={verifyCode.length !== 6}
              onPress={() => void handleVerify()}
            />
            <Button
              label="Cancel setup"
              variant="outline"
              style={{ marginTop: spacing(2) }}
              onPress={() => void handleCancelSetup()}
            />
          </View>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>Recovery codes</Text>
      <Text style={styles.note}>
        Backup codes are generated during 2FA setup on the web and stored
        hashed there. Setting up on this phone does not create them; to get
        a set, manage 2FA at {WEB_SECURITY_URL}.
      </Text>

      <Text style={styles.sectionTitle}>More</Text>
      <LinkRow
        icon="laptop-outline"
        label="Sessions"
        hint="Recent sign-ins and signing out other devices."
        onPress={() => router.push("/settings/sessions" as Href)}
      />
      <LinkRow
        icon="shield-checkmark-outline"
        label="Account status"
        hint="Warnings and enforcement on your account."
        onPress={() => router.push("/settings/account-status" as Href)}
      />
    </ScrollView>
  );
}

function CredentialBox({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <View style={styles.credBox}>
      <Text style={styles.credLabel}>{label}</Text>
      <View style={styles.credValueRow}>
        <Text style={styles.credValue} selectable>
          {value}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Copy ${label}`}
          onPress={onCopy}
          hitSlop={8}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={20} color={colors.foreground} />
      <View style={styles.linkBody}>
        <Text style={styles.linkLabel}>{label}</Text>
        <Text style={styles.linkHint}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
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
  card: {
    marginHorizontal: spacing(4),
    marginTop: spacing(1),
    padding: spacing(4),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    marginBottom: spacing(3.5),
  },
  statusIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: `${colors.primary}33`,
    backgroundColor: `${colors.primary}1a`,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBody: {
    flex: 1,
    minWidth: 0,
  },
  statusLabel: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  statusHint: {
    marginTop: 2,
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 16,
  },
  badge: {
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing(2.5),
    paddingVertical: 4,
  },
  badgeOn: {
    borderColor: `${colors.success}4d`,
    backgroundColor: `${colors.success}1a`,
  },
  badgeOff: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  setup: {
    marginTop: spacing(4),
  },
  stepTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: spacing(1.5),
    marginTop: spacing(2),
  },
  stepHint: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: spacing(2.5),
  },
  credBox: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing(3),
    marginBottom: spacing(2.5),
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
  },
  credValue: {
    flex: 1,
    color: colors.foreground,
    fontSize: 12.5,
    fontFamily: MONO_FONT,
  },
  codeInput: {
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    color: colors.foreground,
    fontSize: 20,
    letterSpacing: 8,
    textAlign: "center",
    fontFamily: MONO_FONT,
    marginBottom: spacing(3),
  },
  note: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  linkBody: {
    flex: 1,
    minWidth: 0,
  },
  linkLabel: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "500",
  },
  linkHint: {
    marginTop: 1,
    color: colors.mutedForeground,
    fontSize: 12,
  },
});
