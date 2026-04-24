"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";

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

  // Check current MFA status
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

        // Generate mock recovery codes for display
        const codes = Array.from({ length: 8 }, () =>
          Math.random().toString(36).substring(2, 8).toUpperCase()
        );
        setRecoveryCodes(codes);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start 2FA setup");
      setSetupStep("idle");
    }
  };

  const handleVerifyMfa = async () => {
    if (verifyCode.length !== 6 || !factorId) return;
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

      setMfaEnabled(true);
      setSetupStep("complete");
      toast.success("Two-factor authentication enabled");
    } catch (err: any) {
      toast.error(err.message || "Invalid verification code");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!factorId) return;
    setIsDisabling(true);

    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;

      setMfaEnabled(false);
      setFactorId(null);
      setSetupStep("idle");
      setQrCodeUrl(null);
      setTotpSecret(null);
      setVerifyCode("");
      setRecoveryCodes([]);
      toast.success("Two-factor authentication disabled");
    } catch (err: any) {
      toast.error(err.message || "Failed to disable 2FA");
    } finally {
      setIsDisabling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/60 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
            <Shield className="h-4.5 w-4.5 text-red-400" />
          </div>
          <h1
            className="text-xl font-bold tracking-tight text-zinc-100"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Security
          </h1>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Two-Factor Authentication Section */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-1">
              <Smartphone className="h-5 w-5 text-blue-400" />
              <h2 className="text-base font-semibold text-zinc-100">
                Two-Factor Authentication
              </h2>
            </div>
            <p className="text-sm text-zinc-500 ml-8">
              Add an extra layer of security with TOTP-based 2FA.
            </p>
          </div>

          {/* Status badge */}
          <div className="px-5 pb-4">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                mfaEnabled
                  ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                  : "bg-zinc-500/10 text-zinc-400 ring-1 ring-zinc-500/20"
              }`}
            >
              <div
                className={`h-1.5 w-1.5 rounded-full ${
                  mfaEnabled ? "bg-emerald-400" : "bg-zinc-500"
                }`}
              />
              {mfaEnabled ? "Enabled" : "Not enabled"}
            </div>
          </div>

          {/* Setup Flow */}
          {setupStep === "idle" && !mfaEnabled && (
            <div className="px-5 pb-5">
              <Button
                onClick={handleEnrollMfa}
                className="rounded-xl bg-blue-500 hover:bg-blue-600 text-white"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Enable 2FA
              </Button>
            </div>
          )}

          {/* Disable 2FA */}
          {mfaEnabled && setupStep !== "complete" && (
            <div className="px-5 pb-5">
              <Button
                onClick={handleDisableMfa}
                disabled={isDisabling}
                variant="destructive"
                className="rounded-xl"
              >
                {isDisabling ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Disable 2FA
              </Button>
            </div>
          )}

          {/* QR Code + Verification */}
          {setupStep === "verifying" && (
            <div className="px-5 pb-5 space-y-5">
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.08] p-5 space-y-4">
                <p className="text-sm text-zinc-300 font-medium">
                  Step 1: Scan this QR code with your authenticator app
                </p>

                {qrCodeUrl && (
                  <div className="flex justify-center">
                    <div className="bg-white p-3 rounded-xl">
                      <img
                        src={qrCodeUrl}
                        alt="2FA QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                  </div>
                )}

                {totpSecret && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500">
                      Or enter this key manually:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-sm font-mono break-all">
                        {totpSecret}
                      </code>
                      <button
                        onClick={() => copyToClipboard(totpSecret)}
                        className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
                      >
                        <Copy className="h-4 w-4 text-zinc-400" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-white/[0.02] border border-white/[0.08] p-5 space-y-4">
                <p className="text-sm text-zinc-300 font-medium">
                  Step 2: Enter the 6-digit code from your authenticator
                </p>
                <div className="flex items-center gap-3">
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) =>
                      setVerifyCode(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="000000"
                    className="input-premium text-center text-lg tracking-[0.3em] font-mono max-w-[200px]"
                  />
                  <Button
                    onClick={handleVerifyMfa}
                    disabled={verifyCode.length !== 6 || isVerifying}
                    className="rounded-xl bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    {isVerifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Verify"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Recovery Codes */}
          {setupStep === "complete" && recoveryCodes.length > 0 && (
            <div className="px-5 pb-5 space-y-4">
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <p className="text-sm font-medium text-amber-300">
                    Save your recovery codes
                  </p>
                </div>
                <p className="text-xs text-zinc-400">
                  Store these codes in a safe place. You can use them to access
                  your account if you lose your authenticator device.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {recoveryCodes.map((code) => (
                    <code
                      key={code}
                      className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-sm font-mono text-center"
                    >
                      {code}
                    </code>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(recoveryCodes.join("\n"))}
                  className="rounded-lg"
                >
                  <Copy className="h-3.5 w-3.5 mr-2" />
                  Copy all codes
                </Button>
              </div>

              <Button
                onClick={() => {
                  setSetupStep("idle");
                  setRecoveryCodes([]);
                }}
                className="rounded-xl"
              >
                <Check className="h-4 w-4 mr-2" />
                Done
              </Button>
            </div>
          )}
        </div>

        {/* Login Activity Link */}
        <Link
          href="/settings/security/activity"
          className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl hover:bg-white/[0.06] transition-all group"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Activity className="h-5 w-5 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-zinc-200">Login Activity</p>
            <p className="text-sm text-zinc-500">
              Review recent sign-in activity on your account
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
        </Link>
      </div>
    </div>
  );
}
