"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginFormData } from "@/lib/utils/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLoginEvent } from "@/lib/queries/security";

const LOCKOUT_KEY = "orbit_login_lockout";
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

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

const GoogleIcon = () => (
  <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Account lockout state
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);

  // MFA challenge state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaVerifying, setMfaVerifying] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Check lockout status on mount and update countdown
  const checkLockout = useCallback(() => {
    const data = getLockoutData();
    if (data.lockedUntil && data.lockedUntil > Date.now()) {
      setIsLocked(true);
      setLockoutRemaining(data.lockedUntil - Date.now());
      setAttemptsLeft(0);
    } else if (data.lockedUntil && data.lockedUntil <= Date.now()) {
      // Lockout expired
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

  // Countdown timer
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
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const onSubmit = async (data: LoginFormData) => {
    if (isLocked) return;

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      recordFailedAttempt();
      toast.error(error.message);
      return;
    }

    // Check if MFA is required
    if (
      signInData.session &&
      signInData.session.user
    ) {
      // Check for MFA factors
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

      // No MFA required, clear lockout and proceed
      clearLockoutData();

      // Log successful login
      try {
        await createLoginEvent(signInData.session.user.id, "success");
      } catch {
        // Non-blocking
      }

      router.push("/feed");
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

      const { data: verifyData, error: verifyError } =
        await supabase.auth.mfa.verify({
          factorId: mfaFactorId,
          challengeId: challengeData.id,
          code: mfaCode,
        });

      if (verifyError) throw verifyError;

      clearLockoutData();

      // Log successful login
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await createLoginEvent(user.id, "success");
        }
      } catch {
        // Non-blocking
      }

      router.push("/feed");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Invalid verification code");
      setMfaCode("");
    } finally {
      setMfaVerifying(false);
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) toast.error(error.message);
  };

  // MFA Challenge Screen
  if (mfaRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden page-gradient">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-blue-500/[0.04] rounded-full blur-[180px]" />
          <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-purple-500/[0.03] rounded-full blur-[150px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[440px] space-y-6 relative z-10"
        >
          <div className="text-center space-y-2">
            <Link href="/">
              <span
                className="text-5xl font-extrabold tracking-tighter inline-block"
                style={{
                  fontFamily: "var(--font-syne), sans-serif",
                  background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.5) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Orbit
              </span>
            </Link>
          </div>

          <div className="card-elevated p-8 sm:p-10 space-y-7">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10">
                <ShieldCheck className="h-7 w-7 text-blue-400" />
              </div>
              <h1
                className="text-xl font-bold"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                Two-Factor Authentication
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <div className="space-y-5">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(e.target.value.replace(/\D/g, ""))
                }
                placeholder="000000"
                className="input-premium text-center text-2xl tracking-[0.4em] font-mono h-14"
                autoFocus
              />

              <Button
                onClick={handleMfaVerify}
                disabled={mfaCode.length !== 6 || mfaVerifying}
                className="w-full h-12 rounded-full text-[15px] font-bold bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
              >
                {mfaVerifying ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Verify"
                )}
              </Button>

              <button
                onClick={() => {
                  setMfaRequired(false);
                  setMfaCode("");
                  setMfaFactorId(null);
                }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to login
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden page-gradient">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-blue-500/[0.04] rounded-full blur-[180px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-purple-500/[0.03] rounded-full blur-[150px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[440px] space-y-6 relative z-10"
      >
        {/* Logo */}
        <div className="text-center space-y-2">
          <Link href="/">
            <span
              className="text-5xl font-extrabold tracking-tighter inline-block"
              style={{
                fontFamily: "var(--font-syne), sans-serif",
                background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.5) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Orbit
            </span>
          </Link>
        </div>

        {/* Main card */}
        <div className="card-elevated p-8 sm:p-10 space-y-7">
          <div className="text-center">
            <h1
              className="text-xl font-bold"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to your account
            </p>
          </div>

          {/* Lockout Banner */}
          {isLocked && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-red-400" />
                <p className="text-sm font-medium text-red-300">
                  Account temporarily locked
                </p>
              </div>
              <p className="text-xs text-red-400/70">
                Too many failed login attempts. Try again in{" "}
                <span className="font-mono font-bold text-red-300">
                  {formatCountdown(lockoutRemaining)}
                </span>
              </p>
            </motion.div>
          )}

          {/* Google button */}
          <Button
            variant="outline"
            className="btn-social"
            onClick={signInWithGoogle}
            disabled={isLocked}
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="divider-text">
            <span className="text-xs text-muted-foreground/60 uppercase tracking-wider font-medium px-2">or</span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px] text-muted-foreground font-medium">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
                className="input-premium"
                disabled={isLocked}
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[13px] text-muted-foreground font-medium">
                  Password
                </Label>
                <span className="text-xs text-primary hover:underline cursor-pointer font-medium">
                  Forgot password?
                </span>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  {...register("password")}
                  className="input-premium pr-12"
                  disabled={isLocked}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Failed attempts warning */}
            {!isLocked && attemptsLeft < MAX_ATTEMPTS && attemptsLeft > 0 && (
              <p className="text-xs text-amber-400">
                {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
                before temporary lockout
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-full text-[15px] font-bold bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
              disabled={isSubmitting || isLocked}
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Log In"}
            </Button>
          </form>

          {/* Divider */}
          <div className="divider-text">
            <span className="text-xs text-muted-foreground/60 px-2">&nbsp;</span>
          </div>

          {/* Create account */}
          <div className="flex justify-center">
            <Link href="/signup">
              <Button
                variant="outline"
                className="h-11 rounded-full px-8 text-[15px] font-bold border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50"
              >
                Create new account
              </Button>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[13px] text-muted-foreground/50">
          Secure login powered by Orbit
        </p>
      </motion.div>
    </div>
  );
}
