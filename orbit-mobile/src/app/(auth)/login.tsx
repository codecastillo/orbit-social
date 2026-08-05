import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, Link } from "expo-router";
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
  const { mfaPending, addingAccount, finishAddAccount, cancelAddAccount } =
    useAuth();
  // Set when a stored account's session was rejected on switch: the email is
  // known, only the password is missing.
  const { email: emailParam, expired } = useLocalSearchParams<{
    email?: string;
    expired?: string;
  }>();
  const [email, setEmail] = useState(emailParam ?? "");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(
    expired === "1"
      ? "That account was signed out on this device. Log in again to add it back."
      : null,
  );
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
    // The extra account is stored and live; leaving add mode lets the gate
    // move on to the tabs.
    finishAddAccount();
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
      finishAddAccount();
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
    setPassword("");
    setCode("");
    setFactorId(null);
    setFormError(null);
    if (addingAccount) {
      // Puts the account that was active before the add attempt back.
      await cancelAddAccount();
      return;
    }
    // Drop the half-authenticated session, otherwise the gate keeps routing
    // every screen back here.
    await supabase.auth.signOut();
  }

  async function handleCancelAdd() {
    setPassword("");
    setFormError(null);
    await cancelAddAccount();
  }

  if (mfaPending && factorId) {
    return (
      <AuthShell>
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
      // Signing up is a different flow from adding an existing account, and
      // it would leave the app parked on the auth screens.
      footer={
        addingAccount ? null : (
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
          </>
        )
      }
    >
      <OrbitMark size={72} />
      {addingAccount ? (
        <>
          <Text style={styles.title}>Add another account</Text>
          <Text style={styles.sub}>
            You stay signed in to the account you are using now, and can switch
            between them from your profile.
          </Text>
        </>
      ) : (
        <View style={{ height: spacing(9) }} />
      )}

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

      {formError ? <Text style={authStyles.error}>{formError}</Text> : null}

      <Button label="Log in" loading={submitting} onPress={handleSignIn} />
      {addingAccount ? (
        <Button
          label="Cancel"
          variant="outline"
          style={{ marginTop: spacing(3) }}
          disabled={submitting}
          onPress={handleCancelAdd}
        />
      ) : null}

      <Link href="/(auth)/forgot-password" style={authStyles.linkCenter}>
        Forgot password?
      </Link>
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
