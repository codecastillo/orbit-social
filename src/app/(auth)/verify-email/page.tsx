"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthShell, AuthHeading } from "@/components/auth/auth-shell";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "Failed to resend. Try again later.");
      } else {
        setResent(true);
        toast.success("Verification email sent");
        setTimeout(() => setResent(false), 30000);
      }
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setResending(false);
    }
  };

  const steps = [
    "Open your email inbox.",
    "Tap the link from Orbit.",
    "You'll land back here, signed in.",
  ];

  return (
    <AuthShell>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
        <Mail className="h-6 w-6" strokeWidth={1.8} />
      </div>

      <AuthHeading
        eyebrow="Verify email"
        title="Check your"
        accent="inbox"
        sub="We sent a verification link to"
      />

      {email && (
        <div className="mt-3 text-center">
          <span className="inline-flex rounded-lg border border-border bg-background px-3.5 py-1.5 font-mono text-xs text-foreground">
            {email}
          </span>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-border bg-background p-4 text-left">
        {steps.map((text, i) => (
          <div
            key={i}
            className={
              i
                ? "flex items-center gap-3.5 border-t border-border py-2.5"
                : "flex items-center gap-3.5 py-2.5"
            }
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 font-mono text-[11px] font-bold text-primary">
              {i + 1}
            </div>
            <span className="text-[13.5px] text-text-secondary">{text}</span>
          </div>
        ))}
      </div>

      <Button
        variant={resent ? "outline" : "default"}
        className={
          resent
            ? "mt-5 h-11 w-full border-success/40 text-sm text-success"
            : "mt-5 h-11 w-full text-sm"
        }
        onClick={handleResend}
        disabled={resending || resent}
      >
        {resending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : resent ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        {resent ? "Sent, check again in 30s" : "Resend verification"}
      </Button>

      <p className="mt-5 text-center text-[13px] text-text-secondary">
        Wrong email?{" "}
        <Link
          href="/signup"
          className="font-semibold text-primary no-underline hover:underline"
        >
          Start over
        </Link>
      </p>
    </AuthShell>
  );
}
