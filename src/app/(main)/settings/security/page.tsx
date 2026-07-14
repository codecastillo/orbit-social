"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Smartphone,
  Loader2,
  Check,
  Copy,
  ChevronRight,
  AlertTriangle,
  KeyRound,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input, FormSection } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";

type SetupStep = "idle" | "enrolling" | "verifying" | "complete";

export default function SecurityPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupStep, setSetupStep] = useState<SetupStep>("idle");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isDisabling, setIsDisabling] = useState(false);

  useEffect(() => {
    if (!user) return;
    const checkMfa = async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!error && data) {
        const verifiedTotp = data.totp.find((f) => f.status === "verified");
        if (verifiedTotp) {
          setMfaEnabled(true);
          setFactorId(verifiedTotp.id);
        }
      }
      setLoading(false);
    };
    checkMfa();
  }, [user, supabase.auth.mfa]);

  const handleEnrollMfa = async () => {
    setSetupStep("enrolling");
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Orbit Authenticator",
      });
      if (error) throw error;
      if (data) {
        setQrCodeUrl(data.totp.qr_code);
        setTotpSecret(data.totp.secret);
        setFactorId(data.id);
        setSetupStep("verifying");
        const codes = Array.from({ length: 8 }, () =>
          Math.random().toString(36).substring(2, 8).toUpperCase()
        );
        setRecoveryCodes(codes);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start 2FA setup");
      setSetupStep("idle");
    }
  };

  const handleVerifyMfa = async () => {
    if (verifyCode.length !== 6 || !factorId || !user) return;
    setIsVerifying(true);
    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });
      if (verifyError) throw verifyError;

      // Persist hashed recovery codes so a phone-loss recovery flow can
      // verify them later. We never store the plaintext.
      try {
        const hashes = await Promise.all(
          recoveryCodes.map(async (code) => {
            const buf = new TextEncoder().encode(code);
            const digest = await crypto.subtle.digest("SHA-256", buf);
            return Array.from(new Uint8Array(digest))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
          }),
        );
        await supabase.from("mfa_recovery_codes").insert(
          hashes.map((code_hash) => ({ user_id: user.id, code_hash })),
        );
      } catch {
        // Non-fatal: user still gets MFA, just without persisted backup codes.
      }

      setMfaEnabled(true);
      setSetupStep("complete");
      toast.success("Two-factor enabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!factorId || !user) return;
    setIsDisabling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      // Wipe stored recovery code hashes: they're paired to the disabled factor.
      try {
        await supabase.from("mfa_recovery_codes").delete().eq("user_id", user.id);
      } catch {}
      setMfaEnabled(false);
      setFactorId(null);
      setSetupStep("idle");
      setQrCodeUrl(null);
      setTotpSecret(null);
      setVerifyCode("");
      setRecoveryCodes([]);
      toast.success("Two-factor disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disable");
    } finally {
      setIsDisabling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusOn = mfaEnabled;

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <SettingsHeader section="Security" glyph="◈" />

      <div>
        <h1 className="mt-1 text-5xl font-bold leading-none tracking-[-0.035em] text-foreground">
          Locked <span className="text-primary">down</span>.
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[14.5px] leading-[1.55] text-muted-foreground">
          2FA and session history for your account.
        </p>
      </div>

      <FormSection
        title="Two-factor authentication"
        hint={statusOn ? "ENABLED" : "NOT ENABLED"}
      >
        <div className="mb-3.5 flex items-center gap-3.5">
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <Smartphone className="h-[18px] w-[18px] text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Authenticator app</div>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
              TOTP codes from apps like 1Password, Authy, or Google Authenticator.
            </div>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-bold tracking-[0.12em] ${
              statusOn
                ? "border-success/30 bg-success/10 text-success"
                : "border-border bg-surface text-muted-foreground"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${statusOn ? "bg-success" : "bg-text-faint"}`}
            />
            {statusOn ? "ENABLED" : "OFF"}
          </div>
        </div>

        {setupStep === "idle" && !mfaEnabled && (
          <Button size="lg" onClick={handleEnrollMfa}>
            <KeyRound className="h-3.5 w-3.5" />
            Enable 2FA
          </Button>
        )}

        {mfaEnabled && setupStep !== "complete" && (
          <Button variant="destructive" onClick={handleDisableMfa} disabled={isDisabling}>
            {isDisabling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Disable 2FA
          </Button>
        )}

        {setupStep === "verifying" && (
          <div className="mt-1 flex flex-col gap-3.5">
            <div className="rounded-xl border border-border bg-surface p-[18px]">
              <p className="mb-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
                ◇&nbsp;&nbsp;STEP 1 · SCAN
              </p>
              {qrCodeUrl && (
                <div className="my-3 flex justify-center">
                  <div className="rounded-xl bg-white p-3">
                    <img src={qrCodeUrl} alt="2FA QR Code" className="h-44 w-44" />
                  </div>
                </div>
              )}
              {totpSecret && (
                <div className="mt-2.5">
                  <div className="mb-1.5 text-[11.5px] text-muted-foreground">
                    Or enter this key manually:
                  </div>
                  <div className="flex gap-2">
                    <code className="flex-1 break-all rounded-lg border border-border bg-surface-elevated px-3 py-2.5 font-mono text-xs text-foreground">
                      {totpSecret}
                    </code>
                    <button
                      onClick={() => copyToClipboard(totpSecret)}
                      aria-label="Copy setup key"
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface p-[18px]">
              <p className="mb-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
                ◆&nbsp;&nbsp;STEP 2 · VERIFY
              </p>
              <div className="flex gap-2.5">
                <div className="flex-1">
                  <Field label="6-digit code from app">
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      // Inline because the compat Input sets its own inline
                      // font styles, which would override utility classes.
                      style={{
                        textAlign: "center",
                        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                        fontSize: 18,
                        letterSpacing: "0.3em",
                      }}
                    />
                  </Field>
                </div>
                <Button
                  className="mt-7 self-start"
                  onClick={handleVerifyMfa}
                  disabled={verifyCode.length !== 6 || isVerifying}
                >
                  {isVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verify"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {setupStep === "complete" && recoveryCodes.length > 0 && (
          <div className="mt-1">
            <div className="rounded-xl border border-warning/25 bg-warning/10 p-[18px]">
              <div className="mb-2.5 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                <span className="text-[13px] font-semibold text-warning">
                  Save your recovery codes
                </span>
              </div>
              <p className="mb-3.5 text-xs leading-normal text-muted-foreground">
                Keep these in a safe place. You'll need one if you lose your authenticator.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {recoveryCodes.map((code) => (
                  <code
                    key={code}
                    className="rounded-lg bg-surface-elevated px-2.5 py-2 text-center font-mono text-xs tracking-[0.06em] text-foreground"
                  >
                    {code}
                  </code>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3.5"
                onClick={() => copyToClipboard(recoveryCodes.join("\n"))}
              >
                <Copy className="h-3 w-3" />
                Copy all
              </Button>
            </div>
            <Button
              size="lg"
              className="mt-3.5"
              onClick={() => {
                setSetupStep("idle");
                setRecoveryCodes([]);
              }}
            >
              <Check className="h-3.5 w-3.5" />
              Done
            </Button>
          </div>
        )}
      </FormSection>

      <Link
        href="/settings/security/activity"
        className="mt-2 flex items-center gap-3.5 rounded-xl border border-border bg-surface p-4 text-foreground no-underline"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
          <Activity className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Login activity</div>
          <div className="mt-0.5 text-[12.5px] text-muted-foreground">
            Recent sign-ins to your account.
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-text-faint" />
      </Link>
    </div>
  );
}
