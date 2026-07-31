import { useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { Button, Field } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { colors, spacing } from "@/lib/theme";

// Same password policy as the web account page's zod schema.
const PASSWORD_MIN_LENGTH = 10;
const WEB_ACCOUNT_URL = "https://orbitsocial.net/settings/account";

function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/[A-Z]/.test(password)) {
    return "Must contain at least one uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Must contain at least one lowercase letter";
  }
  if (!/[0-9]/.test(password)) return "Must contain at least one number";
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return "Must contain at least one special character";
  }
  return null;
}

export default function AccountSettingsScreen() {
  const { user } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newError, setNewError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleChangePassword = async () => {
    const invalid = passwordError(newPassword);
    const mismatch =
      newPassword === confirmPassword ? null : "Passwords don't match";
    setNewError(invalid);
    setConfirmError(mismatch);
    setSubmitError(null);
    setSaved(false);
    if (invalid || mismatch) return;

    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setSaving(false);
    if (error) {
      // Supabase can demand a recent login here; its message says so, so
      // surface it verbatim instead of a generic failure.
      setSubmitError(error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setSaved(true);
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Account" }} />

      <Text style={styles.sectionTitle}>Email</Text>
      <View style={styles.emailRow}>
        <Text style={styles.emailValue}>{user.email ?? "No email on file"}</Text>
      </View>

      <Text style={styles.sectionTitle}>Change password</Text>
      <View style={styles.formSection}>
        <Field
          label="New password"
          placeholder="Min 10 chars, mixed case, number, symbol"
          value={newPassword}
          onChangeText={(value) => {
            setNewPassword(value);
            setSaved(false);
          }}
          secureTextEntry
          autoCapitalize="none"
          error={newError}
        />
        <Field
          label="Confirm new password"
          placeholder="Repeat new password"
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            setSaved(false);
          }}
          secureTextEntry
          autoCapitalize="none"
          error={confirmError}
        />
        {submitError ? (
          <Text style={styles.submitError}>{submitError}</Text>
        ) : null}
        {saved ? <Text style={styles.submitSuccess}>Password updated.</Text> : null}
        <Button
          label="Update password"
          loading={saving}
          disabled={!newPassword || !confirmPassword}
          onPress={() => void handleChangePassword()}
        />
      </View>

      <Text style={styles.sectionTitle}>Delete account</Text>
      <View style={styles.formSection}>
        <Text style={styles.deleteExplainer}>
          Account deletion currently completes on the web. Open your account
          settings at orbitsocial.net, confirm there, and everything is
          removed for this app too.
        </Text>
        <Button
          label="Open account settings on the web"
          variant="destructive"
          onPress={() => void Linking.openURL(WEB_ACCOUNT_URL)}
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
  emailRow: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  emailValue: {
    color: colors.foreground,
    fontSize: 14.5,
  },
  formSection: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  submitError: {
    color: colors.destructive,
    fontSize: 12.5,
    marginBottom: spacing(3),
  },
  submitSuccess: {
    color: colors.success,
    fontSize: 12.5,
    marginBottom: spacing(3),
  },
  deleteExplainer: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing(3),
  },
});
