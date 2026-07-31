import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Button, Field } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

const MIN_PASSWORD_LENGTH = 6;

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSignUp() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFormError("Enter your email.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setFormError("Passwords do not match.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });
    setSubmitting(false);
    if (error) {
      setFormError(
        /captcha/i.test(error.message)
          ? "Signing up here needs a captcha check. Create your account on the web first, then sign in."
          : error.message,
      );
      return;
    }
    // Supabase returns a user with no identities when the email is already
    // registered, instead of an error.
    if (data.user && data.user.identities?.length === 0) {
      setFormError("An account with this email already exists. Sign in instead.");
      return;
    }
    if (data.session) {
      // Email confirmation is off; the AuthGate redirects to the tabs. If
      // web onboarding never ran, the profile tab asks for a username.
      return;
    }
    setSentTo(trimmedEmail);
  }

  if (sentTo) {
    return (
      <View style={styles.confirmWrap}>
        <Text style={styles.wordmark}>Orbit</Text>
        <Text style={styles.confirmTitle}>Check your email</Text>
        <Text style={styles.confirmBody}>
          We sent a verification link to {sentTo}. Open it to activate your
          account, then come back and sign in.
        </Text>
        <Button
          label="Back to sign in"
          variant="outline"
          onPress={() => router.replace("/(auth)/login")}
          style={styles.confirmButton}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.wordmark}>Orbit</Text>
        <Text style={styles.tagline}>Create your account</Text>

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Field
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Repeat your password"
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={handleSignUp}
        />

        {formError ? <Text style={styles.error}>{formError}</Text> : null}

        <Button label="Create account" loading={submitting} onPress={handleSignUp} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" style={styles.footerLink}>
            Sign in
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing(6),
  },
  wordmark: {
    color: colors.foreground,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    textAlign: "center",
  },
  tagline: {
    color: colors.mutedForeground,
    fontSize: 14,
    textAlign: "center",
    marginTop: spacing(1),
    marginBottom: spacing(8),
  },
  error: {
    color: colors.destructive,
    fontSize: 13,
    marginBottom: spacing(3),
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing(6),
  },
  footerText: {
    color: colors.mutedForeground,
    fontSize: 13.5,
  },
  footerLink: {
    color: colors.primary,
    fontSize: 13.5,
    fontWeight: "600",
  },
  confirmWrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(8),
  },
  confirmTitle: {
    color: colors.foreground,
    fontSize: 19,
    fontWeight: "700",
    marginTop: spacing(8),
  },
  confirmBody: {
    color: colors.mutedForeground,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    marginTop: spacing(2),
    maxWidth: 320,
  },
  confirmButton: {
    marginTop: spacing(6),
    alignSelf: "stretch",
  },
});
