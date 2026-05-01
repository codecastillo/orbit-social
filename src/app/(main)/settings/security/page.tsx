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
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, PillBtn } from "@/components/orbit/primitives";
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
        // Non-fatal — user still gets MFA, just without persisted backup codes.
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
      // Wipe stored recovery code hashes — they're paired to the disabled factor.
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
      <div style={{ padding: 48, display: "flex", justifyContent: "center" }}>
        <Loader2 style={{ width: 20, height: 20, color: O.ink3 }} className="animate-spin" />
      </div>
    );
  }

  const statusOn = mfaEnabled;

  return (
    <div style={{ color: O.ink, fontFamily: O.sans, display: "flex", flexDirection: "column", gap: 18 }}>
      <SettingsHeader section="Security" glyph="◈" />

      <div>
        <Display size={48} style={{ marginTop: 4 }}>
          Locked <Acc>down</Acc>.
        </Display>
        <p style={{ fontSize: 14.5, color: O.ink3, marginTop: 10, lineHeight: 1.55, maxWidth: 560 }}>
          2FA and session history for your account.
        </p>
      </div>

      <FormSection
        title="Two-factor authentication"
        hint={statusOn ? "ENABLED" : "NOT ENABLED"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: `${O.a3}15`,
              border: `1px solid ${O.a3}33`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Smartphone style={{ width: 18, height: 18, color: O.a3 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Authenticator app</div>
            <div style={{ fontSize: 12.5, color: O.ink3, marginTop: 2 }}>
              TOTP codes from apps like 1Password, Authy, or Google Authenticator.
            </div>
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 99,
              fontSize: 10.5,
              fontWeight: 700,
              fontFamily: O.mono,
              letterSpacing: "0.12em",
              background: statusOn
                ? "rgba(125,255,163,0.12)"
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${statusOn ? "rgba(125,255,163,0.3)" : O.hair}`,
              color: statusOn ? "#7dffa3" : O.ink3,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: statusOn ? "#7dffa3" : O.ink4,
              }}
            />
            {statusOn ? "ENABLED" : "OFF"}
          </div>
        </div>

        {setupStep === "idle" && !mfaEnabled && (
          <PillBtn primary size="lg" onClick={handleEnrollMfa}>
            <KeyRound style={{ width: 14, height: 14 }} />
            Enable 2FA
          </PillBtn>
        )}

        {mfaEnabled && setupStep !== "complete" && (
          <button
            onClick={handleDisableMfa}
            disabled={isDisabling}
            style={{
              padding: "10px 18px",
              borderRadius: 99,
              background: "rgba(255,122,133,0.1)",
              border: "1px solid rgba(255,122,133,0.4)",
              color: "#ff9aa3",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: O.sans,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {isDisabling && <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />}
            Disable 2FA
          </button>
        )}

        {setupStep === "verifying" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            <div
              style={{
                ...panel({ borderRadius: 16 }),
                padding: 18,
              }}
            >
              <div
                style={{
                  fontFamily: O.mono,
                  fontSize: 10.5,
                  letterSpacing: "0.18em",
                  color: O.a3,
                  marginBottom: 12,
                }}
              >
                ◇&nbsp;&nbsp;STEP 1 · SCAN
              </div>
              {qrCodeUrl && (
                <div style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}>
                  <div style={{ background: "white", padding: 12, borderRadius: 16 }}>
                    <img src={qrCodeUrl} alt="2FA QR Code" style={{ width: 176, height: 176 }} />
                  </div>
                </div>
              )}
              {totpSecret && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11.5, color: O.ink3, marginBottom: 6 }}>
                    Or enter this key manually:
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <code
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "rgba(0,0,0,0.3)",
                        border: `1px solid ${O.hair}`,
                        fontFamily: O.mono,
                        fontSize: 12,
                        color: O.ink,
                        wordBreak: "break-all",
                      }}
                    >
                      {totpSecret}
                    </code>
                    <button
                      onClick={() => copyToClipboard(totpSecret)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: O.glass,
                        border: `1px solid ${O.hair2}`,
                        color: O.ink3,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Copy style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ ...panel({ borderRadius: 16 }), padding: 18 }}>
              <div
                style={{
                  fontFamily: O.mono,
                  fontSize: 10.5,
                  letterSpacing: "0.18em",
                  color: O.a3,
                  marginBottom: 12,
                }}
              >
                ◆&nbsp;&nbsp;STEP 2 · VERIFY
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="6-digit code from app">
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      style={{
                        textAlign: "center",
                        fontFamily: O.mono,
                        fontSize: 18,
                        letterSpacing: "0.3em",
                      }}
                    />
                  </Field>
                </div>
                <PillBtn
                  primary
                  onClick={handleVerifyMfa}
                  disabled={verifyCode.length !== 6 || isVerifying}
                  style={{ alignSelf: "flex-start", marginTop: 28 }}
                >
                  {isVerifying ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : "Verify"}
                </PillBtn>
              </div>
            </div>
          </div>
        )}

        {setupStep === "complete" && recoveryCodes.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div
              style={{
                ...panel({ borderRadius: 16 }),
                padding: 18,
                background: "rgba(255,215,106,0.06)",
                border: "1px solid rgba(255,215,106,0.25)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <AlertTriangle style={{ width: 14, height: 14, color: "#ffd76a" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#ffd76a" }}>
                  Save your recovery codes
                </span>
              </div>
              <p style={{ fontSize: 12, color: O.ink3, margin: "0 0 14px", lineHeight: 1.5 }}>
                Keep these in a safe place. You'll need one if you lose your authenticator.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {recoveryCodes.map((code) => (
                  <code
                    key={code}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "rgba(0,0,0,0.3)",
                      fontFamily: O.mono,
                      fontSize: 12,
                      color: O.ink,
                      textAlign: "center",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {code}
                  </code>
                ))}
              </div>
              <PillBtn
                size="sm"
                onClick={() => copyToClipboard(recoveryCodes.join("\n"))}
                style={{ marginTop: 14 }}
              >
                <Copy style={{ width: 12, height: 12 }} />
                Copy all
              </PillBtn>
            </div>
            <PillBtn
              primary
              size="lg"
              style={{ marginTop: 14 }}
              onClick={() => {
                setSetupStep("idle");
                setRecoveryCodes([]);
              }}
            >
              <Check style={{ width: 14, height: 14 }} />
              Done
            </PillBtn>
          </div>
        )}
      </FormSection>

      <Link
        href="/settings/security/activity"
        style={{
          ...panel({ borderRadius: 18 }),
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 14,
          textDecoration: "none",
          color: O.ink,
          marginTop: 8,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: `${O.a1}1a`,
            border: `1px solid ${O.a1}33`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Activity style={{ width: 16, height: 16, color: O.a1 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Login activity</div>
          <div style={{ fontSize: 12.5, color: O.ink3, marginTop: 2 }}>
            Recent sign-ins to your account.
          </div>
        </div>
        <ChevronRight style={{ width: 16, height: 16, color: O.ink4 }} />
      </Link>
    </div>
  );
}
