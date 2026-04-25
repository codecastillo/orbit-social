"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { O, orbitBg, panel, aurora } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { Field, Input } from "@/components/orbit/forms";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  // On mount, listen for the PASSWORD_RECOVERY event Supabase fires
  // when the user lands here from the reset email.
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasRecoverySession(true);
      }
    });
    // Also check if a session already exists (covers the case where
    // Supabase has already processed the URL hash by the time we mount).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setHasRecoverySession(true);
      else setHasRecoverySession(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    toast.success("Password updated.");
    setTimeout(() => router.push("/feed"), 1500);
  };

  return (
    <main
      style={{
        ...orbitBg,
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 48,
        color: O.ink,
        fontFamily: O.sans,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: "100%", maxWidth: 460 }}
      >
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span
              style={{
                fontFamily: O.serif,
                fontStyle: "italic",
                fontSize: 36,
                background: aurora,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "-0.02em",
              }}
            >
              orbit
            </span>
          </Link>
        </div>

        <div style={{ ...panel({ borderRadius: 24 }), padding: 40 }}>
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 14px",
              borderRadius: "50%",
              background: `${O.a3}15`,
              border: `1px solid ${O.a3}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: O.a3,
            }}
          >
            {done ? (
              <CheckCircle style={{ width: 28, height: 28 }} strokeWidth={1.8} />
            ) : (
              <Lock style={{ width: 26, height: 26 }} strokeWidth={1.8} />
            )}
          </div>

          <div style={{ textAlign: "center" }}>
            <Eyebrow accent>◇&nbsp;&nbsp;NEW · PASSWORD</Eyebrow>
            <Display size={30} style={{ marginTop: 10 }}>
              {done ? (
                <>
                  All <Acc>set</Acc>.
                </>
              ) : (
                <>
                  Set a <Acc>new</Acc> password.
                </>
              )}
            </Display>
            <p
              style={{
                fontSize: 13.5,
                color: O.ink3,
                marginTop: 10,
                lineHeight: 1.55,
              }}
            >
              {done
                ? "Sending you to your feed…"
                : "Pick something at least 8 characters. You'll be signed in right after."}
            </p>
          </div>

          {hasRecoverySession === false ? (
            <div
              style={{
                marginTop: 22,
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(255,193,76,0.08)",
                border: "1px solid rgba(255,193,76,0.32)",
                color: O.ink2,
                fontSize: 13,
                textAlign: "center",
              }}
            >
              This reset link is invalid or has expired.{" "}
              <Link
                href="/forgot-password"
                style={{ color: O.a3, textDecoration: "none", fontWeight: 600 }}
              >
                Send a new one →
              </Link>
            </div>
          ) : (
            !done && (
              <form onSubmit={handleSubmit} style={{ marginTop: 26 }}>
                <Field label="New password" error={error || undefined}>
                  <div style={{ position: "relative" }}>
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoFocus
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        color: O.ink3,
                        cursor: "pointer",
                        padding: 0,
                      }}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff style={{ width: 16, height: 16 }} />
                      ) : (
                        <Eye style={{ width: 16, height: 16 }} />
                      )}
                    </button>
                  </div>
                </Field>

                <Field label="Confirm">
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Re-enter the same password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={submitting}
                  />
                </Field>

                <PillBtn
                  size="lg"
                  type="submit"
                  disabled={submitting}
                  style={{
                    marginTop: 18,
                    width: "100%",
                    justifyContent: "center",
                  }}
                >
                  {submitting ? (
                    <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                  ) : (
                    <Lock style={{ width: 14, height: 14 }} />
                  )}
                  {submitting ? "Updating…" : "Update password"}
                </PillBtn>
              </form>
            )
          )}
        </div>
      </motion.div>
    </main>
  );
}
