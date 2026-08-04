import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui";
import {
  AuthInput,
  AuthShell,
  OrbitMark,
  authStyles,
} from "@/components/auth-shell";
import { colors, spacing } from "@/lib/theme";

const MIN_PASSWORD_LENGTH = 6;
// The legal documents live on the web app; the app opens them in the browser
// rather than shipping a second copy that can drift out of date.
const WEB_TERMS_URL = "https://orbitsocial.net/terms";
const WEB_PRIVACY_URL = "https://orbitsocial.net/privacy";

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
      <AuthShell
        footer={
          <Button
            label="Back to log in"
            variant="outline"
            onPress={() => router.replace("/(auth)/login")}
          />
        }
      >
        <OrbitMark size={56} />
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.sub}>
          We sent a verification link to {sentTo}. Open it to activate your
          account, then come back and log in.
        </Text>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      footer={
        <>
          <View style={authStyles.divider}>
            <View style={authStyles.dividerLine} />
            <Text style={authStyles.dividerText}>OR</Text>
            <View style={authStyles.dividerLine} />
          </View>
          <Button
            label="Log in instead"
            variant="outline"
            onPress={() => router.replace("/(auth)/login")}
          />
          <Text style={[authStyles.wordmarkFooter, { marginTop: spacing(5) }]}>
            Orbit
          </Text>
        </>
      }
    >
      <OrbitMark size={56} />
      <Text style={styles.title}>Join Orbit</Text>
      <Text style={styles.sub}>
        One account for the web and the app.
      </Text>

      <AuthInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <AuthInput
        value={password}
        onChangeText={setPassword}
        placeholder={`Password (at least ${MIN_PASSWORD_LENGTH} characters)`}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <AuthInput
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Confirm password"
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={handleSignUp}
      />

      {formError ? <Text style={authStyles.error}>{formError}</Text> : null}

      <Button label="Create account" loading={submitting} onPress={handleSignUp} />

      <Text style={styles.agreement}>
        By creating an account you agree to the{" "}
        <Text
          style={styles.agreementLink}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(WEB_TERMS_URL)}
        >
          Terms of Service
        </Text>{" "}
        and{" "}
        <Text
          style={styles.agreementLink}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(WEB_PRIVACY_URL)}
        >
          Privacy Policy
        </Text>
        . You must be at least 13 years old.
      </Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.foreground,
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.4,
    textAlign: "center",
    marginTop: spacing(6),
  },
  agreement: {
    color: colors.mutedForeground,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: "center",
    marginTop: spacing(4),
    paddingHorizontal: spacing(2),
  },
  agreementLink: {
    color: colors.primary,
    fontWeight: "600",
  },
  sub: {
    color: colors.mutedForeground,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: "center",
    marginTop: spacing(2),
    marginBottom: spacing(6),
    paddingHorizontal: spacing(4),
  },
});
