import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Button, Field } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setFormError("Enter your email and password.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setSubmitting(false);
    if (error) {
      // The web app enforces Turnstile captcha through its own UI; the mobile
      // client cannot complete that challenge.
      setFormError(
        /captcha/i.test(error.message)
          ? "This account needs a captcha check. Sign in on the web first, then come back."
          : error.message,
      );
    }
    // On success the AuthGate in the root layout redirects to the tabs.
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
        <Text style={styles.tagline}>Sign in to your account</Text>

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
          placeholder="Your password"
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={handleSignIn}
        />

        {formError ? <Text style={styles.error}>{formError}</Text> : null}

        <Button label="Sign in" loading={submitting} onPress={handleSignIn} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to Orbit? </Text>
          <Link href="/(auth)/signup" style={styles.footerLink}>
            Create an account
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
});
