"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginFormData } from "@/lib/utils/validators";
import { safeNext } from "@/lib/utils/post-auth-redirect";
import { createLoginEvent } from "@/lib/queries/security";
import { O, orbitBg, panel, aurora } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { Field, Input } from "@/components/orbit/forms";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/auth/turnstile-widget";

const LOCKOUT_KEY = "orbit_login_lockout";
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

interface LockoutData {
  attempts: number;
  lockedUntil: number | null;
}

function getLockoutData(): LockoutData {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { attempts: 0, lockedUntil: null };
}

function setLockoutData(data: LockoutData) {
  try {
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify(data));
  } catch {}
}

function clearLockoutData() {
  try {
    localStorage.removeItem(LOCKOUT_KEY);
  } catch {}
}

function Shell({ children }: { children: React.ReactNode }) {
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
          {children}
        </div>
        <p
          style={{
            textAlign: "center",
            marginTop: 14,
            fontSize: 11,
            color: O.ink4,
            fontFamily: O.mono,
            letterSpacing: "0.08em",
          }}
        >
          ◇&nbsp;&nbsp;SECURE · END-TO-END
        </p>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNext(searchParams.get("next")) ?? "/feed";
  const supabase = createClient();

  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);

  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const checkLockout = useCallback(() => {
    const data = getLockoutData();
    if (data.lockedUntil && data.lockedUntil > Date.now()) {
      setIsLocked(true);
      setLockoutRemaining(data.lockedUntil - Date.now());
      setAttemptsLeft(0);
    } else if (data.lockedUntil && data.lockedUntil <= Date.now()) {
      clearLockoutData();
      setIsLocked(false);
      setAttemptsLeft(MAX_ATTEMPTS);
    } else {
      setAttemptsLeft(MAX_ATTEMPTS - data.attempts);
    }
  }, []);

  useEffect(() => {
    checkLockout();
  }, [checkLockout]);

  useEffect(() => {
    if (!isLocked) return;
    const interval = setInterval(() => {
      const data = getLockoutData();
      if (data.lockedUntil && data.lockedUntil > Date.now()) {
        setLockoutRemaining(data.lockedUntil - Date.now());
      } else {
        clearLockoutData();
        setIsLocked(false);
        setAttemptsLeft(MAX_ATTEMPTS);
        setLockoutRemaining(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLocked]);

  const recordFailedAttempt = () => {
    const data = getLockoutData();
    data.attempts += 1;
    if (data.attempts >= MAX_ATTEMPTS) {
      data.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      setIsLocked(true);
      setLockoutRemaining(LOCKOUT_DURATION_MS);
    }
    setLockoutData(data);
    setAttemptsLeft(MAX_ATTEMPTS - data.attempts);
  };

  const formatCountdown = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const onSubmit = async (data: LoginFormData) => {
    if (isLocked) return;

    const captchaToken = (await turnstileRef.current?.getToken()) ?? undefined;

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
      options: { captchaToken },
    });
    turnstileRef.current?.reset();

    if (error) {
      recordFailedAttempt();
      toast.error(error.message);
      return;
    }

    if (signInData.session && signInData.session.user) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors && factors.totp.length > 0) {
        const verifiedFactor = factors.totp.find(
          (f) => f.status === "verified"
        );
        if (verifiedFactor) {
          setMfaRequired(true);
          setMfaFactorId(verifiedFactor.id);
          return;
        }
      }
      clearLockoutData();
      try {
        await createLoginEvent(signInData.session.user.id, "success");
      } catch {}
      try {
        await supabase.rpc("touch_last_seen");
      } catch {}
      router.push(nextPath);
      router.refresh();
    }
  };

  const handleMfaVerify = async () => {
    if (mfaCode.length !== 6 || !mfaFactorId) return;
    setMfaVerifying(true);
    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;

      clearLockoutData();
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await createLoginEvent(user.id, "success");
      } catch {}
      try {
        await supabase.rpc("touch_last_seen");
      } catch {}

      router.push(nextPath);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid verification code");
      setMfaCode("");
    } finally {
      setMfaVerifying(false);
    }
  };

  // MFA screen
  if (mfaRequired) {
    return (
      <Shell>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 16px",
              borderRadius: "50%",
              background: `color-mix(in oklab, ${O.a3} 8%, transparent)`,
              border: `1px solid color-mix(in oklab, ${O.a3} 27%, transparent)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: O.a3,
            }}
          >
            <ShieldCheck style={{ width: 26, height: 26 }} />
          </div>
          <Eyebrow accent>◆&nbsp;&nbsp;TWO-FACTOR</Eyebrow>
          <Display size={28} style={{ marginTop: 10 }}>
            Verify it&apos;s <Acc>you</Acc>.
          </Display>
          <p
            style={{
              fontSize: 13.5,
              color: O.ink3,
              marginTop: 10,
              lineHeight: 1.55,
            }}
          >
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        <div style={{ marginTop: 24 }}>
          <Field label="Code">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={mfaCode}
              onChange={(e) =>
                setMfaCode(e.target.value.replace(/\D/g, ""))
              }
              placeholder="000000"
              style={{
                textAlign: "center",
                fontSize: 22,
                letterSpacing: "0.3em",
                fontFamily: O.mono,
              }}
              autoFocus
            />
          </Field>
        </div>

        <PillBtn
          primary
          size="lg"
          onClick={handleMfaVerify}
          disabled={mfaCode.length !== 6 || mfaVerifying}
          style={{
            width: "100%",
            justifyContent: "center",
            marginTop: 12,
          }}
        >
          {mfaVerifying ? (
            <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
          ) : (
            "Verify →"
          )}
        </PillBtn>

        <button
          type="button"
          onClick={() => {
            setMfaRequired(false);
            setMfaCode("");
            setMfaFactorId(null);
          }}
          style={{
            width: "100%",
            marginTop: 14,
            padding: "10px 0",
            background: "transparent",
            border: "none",
            fontSize: 12.5,
            color: O.ink3,
            cursor: "pointer",
            fontFamily: O.mono,
            letterSpacing: "0.04em",
          }}
        >
          ← BACK TO SIGN IN
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ textAlign: "center" }}>
        <Eyebrow accent>◇&nbsp;&nbsp;SIGN IN</Eyebrow>
        <Display size={36} style={{ marginTop: 10 }}>
          Welcome <Acc>back</Acc>.
        </Display>
        <p
          style={{
            fontSize: 13.5,
            color: O.ink3,
            marginTop: 10,
            lineHeight: 1.55,
          }}
        >
          Pick up where you left off.
        </p>
      </div>

      {/* Lockout banner */}
      {isLocked && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 14,
            background: "rgba(255,122,133,0.08)",
            border: "1px solid rgba(255,122,133,0.25)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Lock style={{ width: 15, height: 15, color: "#ff7a85" }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: "#ff9aa3", margin: 0 }}>
              Account temporarily locked
            </p>
          </div>
          <p
            style={{
              fontSize: 12,
              color: "#ff9aa3",
              opacity: 0.75,
              marginTop: 6,
              marginBottom: 0,
            }}
          >
            Too many failed attempts. Try again in{" "}
            <span style={{ fontFamily: O.mono, fontWeight: 700, color: "#ff7a85" }}>
              {formatCountdown(lockoutRemaining)}
            </span>
            .
          </p>
        </motion.div>
      )}

      {/* Attempts warning */}
      {!isLocked && attemptsLeft < MAX_ATTEMPTS && attemptsLeft > 0 && (
        <div
          style={{
            marginTop: 20,
            padding: "8px 14px",
            borderRadius: 99,
            background: "rgba(255,215,106,0.08)",
            border: "1px solid rgba(255,215,106,0.24)",
            fontFamily: O.mono,
            fontSize: 10.5,
            letterSpacing: "0.12em",
            color: "#ffd76a",
            textAlign: "center",
          }}
        >
          ◆&nbsp;&nbsp;{attemptsLeft} ATTEMPT{attemptsLeft !== 1 ? "S" : ""} LEFT
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} style={{ marginTop: 24 }}>
        <Field label="Email" error={errors.email?.message}>
          <Input
            type="email"
            placeholder="you@example.com"
            {...register("email")}
            disabled={isLocked}
          />
        </Field>

        <Field
          label="Password"
          error={errors.password?.message}
          hint={
            <Link
              href="/forgot-password"
              style={{
                color: O.a3,
                textDecoration: "none",
                fontFamily: O.sans,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "normal",
                textTransform: "none",
              }}
            >
              Forgot password?
            </Link>
          }
        >
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            {...register("password")}
            disabled={isLocked}
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: O.ink3,
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {showPassword ? (
                  <EyeOff style={{ width: 15, height: 15 }} />
                ) : (
                  <Eye style={{ width: 15, height: 15 }} />
                )}
              </button>
            }
          />
        </Field>

        <PillBtn
          primary
          size="lg"
          type="submit"
          disabled={isSubmitting || isLocked}
          style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
        >
          {isSubmitting ? (
            <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
          ) : (
            "Sign in →"
          )}
        </PillBtn>
        <TurnstileWidget ref={turnstileRef} />
      </form>

      {/* Footer */}
      <p
        style={{
          marginTop: 24,
          textAlign: "center",
          fontSize: 13,
          color: O.ink3,
        }}
      >
        No account?{" "}
        <Link
          href={
            nextPath !== "/feed"
              ? `/signup?next=${encodeURIComponent(nextPath)}`
              : "/signup"
          }
          style={{
            color: O.a3,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Create one →
        </Link>
      </p>
    </Shell>
  );
}
