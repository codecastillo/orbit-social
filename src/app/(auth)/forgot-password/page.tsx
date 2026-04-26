"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Mail, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { O, orbitBg, panel, aurora } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { Field, Input } from "@/components/orbit/forms";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/auth/turnstile-widget";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const captchaToken = (await turnstileRef.current?.getToken()) ?? undefined;

    const supabase = createClient();
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo, captchaToken }
    );
    turnstileRef.current?.reset();

    setSubmitting(false);

    if (resetError) {
      // Always show success even on error to prevent email enumeration
      console.warn("password reset error:", resetError.message);
    }
    setSent(true);
    toast.success("If that email exists, a reset link is on its way.");
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
            {sent ? (
              <CheckCircle style={{ width: 28, height: 28 }} strokeWidth={1.8} />
            ) : (
              <Mail style={{ width: 28, height: 28 }} strokeWidth={1.8} />
            )}
          </div>

          <div style={{ textAlign: "center" }}>
            <Eyebrow accent>◇&nbsp;&nbsp;RESET · PASSWORD</Eyebrow>
            <Display size={30} style={{ marginTop: 10 }}>
              {sent ? (
                <>
                  Check your <Acc>inbox</Acc>.
                </>
              ) : (
                <>
                  Forgot your <Acc>password</Acc>?
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
              {sent
                ? "We sent a reset link if an account exists for that email. Tap the link inside to set a new password."
                : "Enter the email tied to your account and we'll send a reset link."}
            </p>
          </div>

          {!sent && (
            <form onSubmit={handleSubmit} style={{ marginTop: 26 }}>
              <Field label="Email" error={error || undefined}>
                <Input
                  type="email"
                  autoFocus
                  autoComplete="email"
                  placeholder="you@orbit.example"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  <Mail style={{ width: 14, height: 14 }} />
                )}
                {submitting ? "Sending…" : "Send reset link"}
              </PillBtn>
              <TurnstileWidget ref={turnstileRef} />
            </form>
          )}

          <div
            style={{
              marginTop: 22,
              textAlign: "center",
              borderTop: `1px solid ${O.hair}`,
              paddingTop: 18,
            }}
          >
            <Link
              href="/login"
              style={{
                color: O.a3,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 13,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
              Back to sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
