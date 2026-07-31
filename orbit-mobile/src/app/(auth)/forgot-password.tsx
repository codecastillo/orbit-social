import { useState } from "react";
import { StyleSheet, Text } from "react-native";
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSend() {
    const trimmed = email.trim();
    if (!trimmed) {
      setFormError("Enter your email.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    // The reset link opens the web flow; same behavior as the site itself.
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: "https://orbitsocial.net/reset-password",
    });
    setSubmitting(false);
    if (error && !/captcha/i.test(error.message)) {
      setFormError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell
      footer={
        <Button
          label="Back to log in"
          variant="outline"
          onPress={() => router.back()}
        />
      }
    >
      <OrbitMark size={56} />
      <Text style={styles.title}>Trouble logging in?</Text>
      <Text style={styles.sub}>
        {sent
          ? "If that email has an account, a reset link is on its way. Open it on this phone or your computer."
          : "Enter your email and we'll send you a link to get back in."}
      </Text>

      {!sent ? (
        <>
          <AuthInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            onSubmitEditing={handleSend}
          />
          {formError ? <Text style={authStyles.error}>{formError}</Text> : null}
          <Button label="Send reset link" loading={submitting} onPress={handleSend} />
        </>
      ) : null}
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
