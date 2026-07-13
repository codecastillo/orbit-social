"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Mail, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AuthShell,
  AuthHeading,
  AuthField,
  AuthInput,
} from "@/components/auth/auth-shell";
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
    <AuthShell>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
        {sent ? (
          <CheckCircle className="h-6 w-6" strokeWidth={1.8} />
        ) : (
          <Mail className="h-6 w-6" strokeWidth={1.8} />
        )}
      </div>

      {sent ? (
        <AuthHeading
          eyebrow="Reset password"
          title="Check your"
          accent="inbox"
          sub="We sent a reset link if an account exists for that email. Tap the link inside to set a new password."
        />
      ) : (
        <AuthHeading
          eyebrow="Reset password"
          title="Forgot your"
          accent="password"
          sub="Enter the email tied to your account and we'll send a reset link."
        />
      )}

      {!sent && (
        <form onSubmit={handleSubmit} className="mt-6">
          <AuthField label="Email" error={error || undefined}>
            <AuthInput
              type="email"
              autoFocus
              autoComplete="email"
              placeholder="you@orbit.example"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </AuthField>

          <Button
            type="submit"
            className="mt-2 h-11 w-full text-sm"
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Send reset link
              </>
            )}
          </Button>
          <TurnstileWidget ref={turnstileRef} />
        </form>
      )}

      <div className="mt-6 border-t border-border pt-5 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary no-underline hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
