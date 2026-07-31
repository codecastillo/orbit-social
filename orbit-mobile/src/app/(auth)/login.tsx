import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter, Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui";
import {
  AuthInput,
  AuthShell,
  OrbitMark,
  authStyles,
} from "@/components/auth-shell";
import { colors, spacing } from "@/lib/theme";

export default function LoginScreen() {
  const router = useRouter();
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
    <AuthShell
      footer={
        <>
          <View style={authStyles.divider}>
            <View style={authStyles.dividerLine} />
            <Text style={authStyles.dividerText}>OR</Text>
            <View style={authStyles.dividerLine} />
          </View>
          <Button
            label="Create new account"
            variant="outline"
            onPress={() => router.push("/(auth)/signup")}
          />
          <Text style={[authStyles.wordmarkFooter, { marginTop: spacing(5) }]}>
            Orbit
          </Text>
        </>
      }
    >
      <OrbitMark size={72} />
      <View style={{ height: spacing(9) }} />

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
        placeholder="Password"
        secure
        autoComplete="password"
        textContentType="password"
        onSubmitEditing={handleSignIn}
      />

      <Link href="/(auth)/forgot-password" style={authStyles.linkRight}>
        Forgot password?
      </Link>

      {formError ? <Text style={authStyles.error}>{formError}</Text> : null}

      <Button label="Log in" loading={submitting} onPress={handleSignIn} />

      <Text style={styles.hint}>
        Use the account you created on orbitsocial.net.
      </Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: colors.textFaint,
    fontSize: 12.5,
    textAlign: "center",
    marginTop: spacing(4),
  },
});
