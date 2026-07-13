"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AuthShell,
  AuthHeading,
  AuthField,
  AuthInput,
} from "@/components/auth/auth-shell";

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
    <AuthShell>
      <div
        className={
          done
            ? "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-success/25 bg-success/10 text-success"
            : "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"
        }
      >
        {done ? (
          <CheckCircle className="h-6 w-6" strokeWidth={1.8} />
        ) : (
          <Lock className="h-6 w-6" strokeWidth={1.8} />
        )}
      </div>

      {done ? (
        <AuthHeading
          eyebrow="New password"
          title="All"
          accent="set"
          sub="Sending you to your feed."
        />
      ) : (
        <AuthHeading
          eyebrow="New password"
          title="Set a new"
          accent="password"
          sub="Pick something at least 8 characters. You'll be signed in right after."
        />
      )}

      {hasRecoverySession === false ? (
        <div className="mt-5 rounded-lg border border-warning/25 bg-warning/10 p-3.5 text-center text-[13px] text-text-secondary">
          This reset link is invalid or has expired.{" "}
          <Link
            href="/forgot-password"
            className="font-semibold text-primary no-underline hover:underline"
          >
            Send a new one
          </Link>
        </div>
      ) : (
        !done && (
          <form onSubmit={handleSubmit} className="mt-6">
            <AuthField label="New password" error={error || undefined}>
              <AuthInput
                type={showPassword ? "text" : "password"}
                autoFocus
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                suffix={
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="flex cursor-pointer items-center border-none bg-transparent p-0 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-[15px] w-[15px]" />
                    ) : (
                      <Eye className="h-[15px] w-[15px]" />
                    )}
                  </button>
                }
              />
            </AuthField>

            <AuthField label="Confirm">
              <AuthInput
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter the same password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
                  <Lock className="h-4 w-4" />
                  Update password
                </>
              )}
            </Button>
          </form>
        )
      )}
    </AuthShell>
  );
}
