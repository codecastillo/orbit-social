import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useRouter, Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui";
import {
  AuthInput,
  AuthShell,
  OrbitMark,
  authStyles,
} from "@/components/auth-shell";
import { getMfaState } from "@/lib/mfa";
import { createLoginEvent } from "@/lib/queries/security";
import { useAuth } from "@/providers/auth-provider";
import { colors, spacing } from "@/lib/theme";

const TOTP_CODE_LENGTH = 6;
const WEB_SECURITY_URL = "orbitsocial.net";

// iOS has no "monospace" alias, so pick its built-in mono face there.
const MONO_FONT = Platform.select({ ios: "Menlo", default: "monospace" });

export default function LoginScreen() {
  const router = useRouter();
  const { mfaPending } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  // The AuthGate parks half-authenticated sessions here, whether the password
  // step just succeeded or the app relaunched mid-challenge, so pick the
  // pending challenge back up instead of showing the sign-in form again.
  useEffect(() => {
    if (!mfaPending) return;
    let active = true;
    getMfaState()
      .then((state) => {
        if (active) setFactorId(state.factorId);
      })
      .catch(() => {
        if (active) {
          setFormError("Could not reach the server to verify your device.");
        }
      });
    return () => {
      active = false;
    };
  }, [mfaPending]);

  async function recordSignIn(userId: string) {
    try {
      await createLoginEvent(userId);
    } catch (err) {
      // The audit entry is not worth blocking a valid sign-in over.
      console.warn("[auth] login event not recorded:", err);
    }
  }

  async function handleSignIn() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setFormError("Enter your email and password.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (error) {
      setSubmitting(false);
      // The web app enforces Turnstile captcha through its own UI; the mobile
      // client cannot complete that challenge.
      setFormError(
        /captcha/i.test(error.message)
          ? "This account needs a captcha check. Sign in on the web first, then come back."
          : error.message,
      );
      return;
    }

    // A verified factor means the session is still aal1 and owes a code; the
    // effect above renders the challenge once the provider agrees.
    try {
      const state = await getMfaState();
      if (state.challengePending) {
        setFactorId(state.factorId);
        setSubmitting(false);
        return;
      }
    } catch {
      // Fall through: the provider fails closed and keeps us on this screen.
    }

    if (data.session) await recordSignIn(data.session.user.id);
    setSubmitting(false);
    // On success the AuthGate in the root layout redirects to the tabs.
  }

  async function handleVerifyCode() {
    if (code.length !== TOTP_CODE_LENGTH || !factorId) return;
    setFormError(null);
    setVerifying(true);
    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await recordSignIn(user.id);
      // The session is aal2 now; the provider clears mfaPending and the
      // AuthGate moves on to the tabs.
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Invalid verification code.",
      );
      setCode("");
    } finally {
      setVerifying(false);
    }
  }

  async function handleCancelChallenge() {
    // Drop the half-authenticated session, otherwise the gate keeps routing
    // every screen back here.
    await supabase.auth.signOut();
    setPassword("");
    setCode("");
    setFactorId(null);
    setFormError(null);
  }

  if (mfaPending && factorId) {
    return (
      <AuthShell
        footer={
          <Text style={[authStyles.wordmarkFooter, { marginTop: spacing(5) }]}>
            Orbit
          </Text>
        }
      >
        <OrbitMark size={56} />
        <Text style={styles.title}>Verify it&apos;s you</Text>
        <Text style={styles.sub}>
          Enter the {TOTP_CODE_LENGTH}-digit code from your authenticator app.
        </Text>

        <AuthInput
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
          placeholder="000000"
          keyboardType="number-pad"
          maxLength={TOTP_CODE_LENGTH}
          textContentType="oneTimeCode"
          autoFocus
          style={styles.codeInput}
          accessibilityLabel={`${TOTP_CODE_LENGTH}-digit code from your authenticator app`}
          onSubmitEditing={handleVerifyCode}
        />

        {formError ? <Text style={authStyles.error}>{formError}</Text> : null}

        <Button
          label="Verify"
          loading={verifying}
          disabled={code.length !== TOTP_CODE_LENGTH}
          onPress={handleVerifyCode}
        />
        <Button
          label="Back to log in"
          variant="outline"
          style={{ marginTop: spacing(3) }}
          onPress={handleCancelChallenge}
        />

        <Text style={styles.hint}>
          Lost your authenticator? Recovery codes are redeemed on{" "}
          {WEB_SECURITY_URL}.
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
  codeInput: {
    fontSize: 20,
    letterSpacing: 8,
    textAlign: "center",
    fontFamily: MONO_FONT,
    paddingRight: spacing(4),
  },
  hint: {
    color: colors.textFaint,
    fontSize: 12.5,
    textAlign: "center",
    marginTop: spacing(4),
  },
});
