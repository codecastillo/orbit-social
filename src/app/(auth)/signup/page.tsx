"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  EyeOff,
  Loader2,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  User,
  Shield,
  Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { fullSignUpSchema, type FullSignUpFormData } from "@/lib/utils/validators";
import { O, orbitBg, panel, aurora } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { Field, Input, TextArea } from "@/components/orbit/forms";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/auth/turnstile-widget";

const GoogleIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const stepLabels = ["ACCOUNT", "SECURITY", "PROFILE"] as const;

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "10+ chars", met: password.length >= 10 },
    { label: "Uppercase", met: /[A-Z]/.test(password) },
    { label: "Lowercase", met: /[a-z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
    { label: "Symbol", met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) },
  ];
  if (!password) return null;
  const metCount = checks.filter((c) => c.met).length;
  const pct = (metCount / checks.length) * 100;
  const color = pct <= 40 ? O.a2 : pct <= 70 ? "#ffd76a" : "#7dffa3";

  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: O.glass2,
          overflow: "hidden",
        }}
      >
        <motion.div
          style={{
            height: "100%",
            borderRadius: 2,
            background: color,
            boxShadow: `0 0 10px ${color}66`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.25 }}
        />
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 10,
        }}
      >
        {checks.map((c) => (
          <span
            key={c.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 9px",
              borderRadius: 99,
              fontSize: 10.5,
              fontFamily: O.mono,
              letterSpacing: "0.04em",
              background: c.met ? "rgba(125,255,163,0.10)" : O.glass,
              color: c.met ? "#7dffa3" : O.ink4,
              border: `1px solid ${c.met ? "rgba(125,255,163,0.25)" : O.hair}`,
            }}
          >
            {c.met ? <Check style={{ width: 10, height: 10 }} /> : <X style={{ width: 10, height: 10 }} />}
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function StepPills({ current }: { current: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        marginTop: 16,
      }}
    >
      {stepLabels.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div
            key={label}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            {i > 0 && (
              <div
                style={{
                  width: 22,
                  height: 1,
                  background: done ? aurora : O.hair,
                }}
              />
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 12px",
                borderRadius: 99,
                background: active || done ? aurora : O.glass,
                border: `1px solid ${active || done ? "transparent" : O.hair2}`,
                color: active || done ? "white" : O.ink3,
                fontFamily: O.mono,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                boxShadow: active
                  ? `0 4px 16px ${O.a2}55`
                  : "none",
              }}
            >
              <span>{i + 1}</span>
              <span>{label}</span>
              {done && <Check style={{ width: 10, height: 10 }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Shell({ children, maxWidth = 520 }: { children: React.ReactNode; maxWidth?: number }) {
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
        style={{ width: "100%", maxWidth }}
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
        <div style={{ ...panel({ borderRadius: 24 }), padding: 36 }}>
          {children}
        </div>
      </motion.div>
    </main>
  );
}

export default function SignUpPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [dobMonth, setDobMonth] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobYear, setDobYear] = useState("");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<FullSignUpFormData>({
    resolver: zodResolver(fullSignUpSchema),
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      dateOfBirth: "",
      password: "",
      confirmPassword: "",
      bio: "",
      agreeToTerms: false,
    },
  });

  const passwordValue = watch("password", "");
  const fullNameValue = watch("fullName", "");
  const usernameValue = watch("username", "");
  const agreeToTerms = watch("agreeToTerms");

  const updateDob = (month: string, day: string, year: string) => {
    const m = month.replace(/\D/g, "");
    const d = day.replace(/\D/g, "");
    const y = year.replace(/\D/g, "");
    if (m.length >= 1 && d.length >= 1 && y.length === 4) {
      setValue("dateOfBirth", `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`, { shouldValidate: true });
    } else {
      setValue("dateOfBirth", "", { shouldValidate: false });
    }
  };

  useEffect(() => {
    if (fullNameValue && !usernameValue) {
      const generated = fullNameValue
        .toLowerCase()
        .replace(/[^a-z0-9\s_]/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 30);
      if (generated.length >= 3) setValue("username", generated);
    }
  }, [fullNameValue, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkUsername = useCallback(
    async (username: string) => {
      if (!username || username.length < 3) {
        setUsernameAvailable(null);
        return;
      }
      setCheckingUsername(true);
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", username.toLowerCase())
        .maybeSingle();
      setUsernameAvailable(!data);
      setCheckingUsername(false);
    },
    [supabase]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (usernameValue && usernameValue.length >= 3) {
        checkUsername(usernameValue);
      } else {
        setUsernameAvailable(null);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [usernameValue, checkUsername]);

  const step1Fields: (keyof FullSignUpFormData)[] = ["fullName", "username", "email", "dateOfBirth"];
  const step2Fields: (keyof FullSignUpFormData)[] = ["password", "confirmPassword"];

  const goNext = async () => {
    const fieldsToValidate = currentStep === 0 ? step1Fields : step2Fields;
    const isValid = await trigger(fieldsToValidate);
    if (!isValid) return;
    if (currentStep === 0 && usernameAvailable === false) {
      toast.error("That username is taken");
      return;
    }
    setDirection(1);
    setCurrentStep((s) => Math.min(s + 1, 2));
  };

  const goBack = () => {
    setDirection(-1);
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("File must be JPEG, PNG, WebP, or GIF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    (window as unknown as { __pendingAvatarFile?: File }).__pendingAvatarFile = file;
  };

  const onSubmit = async (data: FullSignUpFormData) => {
    const captchaToken = (await turnstileRef.current?.getToken()) ?? undefined;

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/callback?next=/feed`,
        captchaToken,
        data: {
          full_name: data.fullName,
          username: data.username.toLowerCase(),
          bio: data.bio || null,
        },
      },
    });
    turnstileRef.current?.reset();
    if (error) {
      toast.error(error.message);
      return;
    }
    router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
  };

  const signUpWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback` },
    });
    if (error) toast.error(error.message);
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <Shell>
      <div style={{ textAlign: "center" }}>
        <Eyebrow accent>◇&nbsp;&nbsp;CREATE · ACCOUNT</Eyebrow>
        <Display size={32} style={{ marginTop: 10 }}>
          Join the <Acc>orbit</Acc>.
        </Display>
        <p
          style={{
            fontSize: 13.5,
            color: O.ink3,
            marginTop: 10,
            lineHeight: 1.55,
          }}
        >
          Small places. People you actually like.
        </p>
      </div>

      <StepPills current={currentStep} />

      <form onSubmit={handleSubmit(onSubmit)} style={{ marginTop: 24 }}>
        <div style={{ minHeight: 340, position: "relative", overflow: "hidden" }}>
          <AnimatePresence mode="wait" custom={direction}>
            {currentStep === 0 && (
              <motion.div
                key="step-0"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <PillBtn
                  size="lg"
                  type="button"
                  onClick={signUpWithGoogle}
                  style={{ width: "100%", justifyContent: "center", gap: 10, marginBottom: 16 }}
                >
                  <GoogleIcon />
                  Sign up with Google
                </PillBtn>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    margin: "16px 0 14px",
                  }}
                >
                  <div style={{ flex: 1, height: 1, background: O.hair }} />
                  <span
                    style={{
                      fontSize: 10.5,
                      fontFamily: O.mono,
                      color: O.ink4,
                      letterSpacing: "0.18em",
                    }}
                  >
                    OR
                  </span>
                  <div style={{ flex: 1, height: 1, background: O.hair }} />
                </div>

                <Field label="Display name" error={errors.fullName?.message}>
                  <Input
                    type="text"
                    placeholder="How others will see you"
                    {...register("fullName")}
                  />
                </Field>

                <Field
                  label="Username"
                  error={
                    errors.username?.message ||
                    (usernameAvailable === false ? "That handle is taken" : undefined)
                  }
                >
                  <Input
                    type="text"
                    placeholder="username"
                    prefix={<span>@</span>}
                    {...register("username")}
                    suffix={
                      checkingUsername ? (
                        <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                      ) : usernameAvailable === true && usernameValue.length >= 3 ? (
                        <Check style={{ width: 14, height: 14, color: "#7dffa3" }} />
                      ) : usernameAvailable === false ? (
                        <X style={{ width: 14, height: 14, color: "#ff7a85" }} />
                      ) : null
                    }
                  />
                </Field>

                <Field label="Email address" error={errors.email?.message}>
                  <Input type="email" placeholder="you@example.com" {...register("email")} />
                </Field>

                <Field label="Date of birth" error={errors.dateOfBirth?.message} hint="Must be at least 13">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.3fr", gap: 8 }}>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="MM"
                      maxLength={2}
                      value={dobMonth}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                        setDobMonth(v);
                        updateDob(v, dobDay, dobYear);
                      }}
                      style={{ textAlign: "center" }}
                    />
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="DD"
                      maxLength={2}
                      value={dobDay}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                        setDobDay(v);
                        updateDob(dobMonth, v, dobYear);
                      }}
                      style={{ textAlign: "center" }}
                    />
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="YYYY"
                      maxLength={4}
                      value={dobYear}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setDobYear(v);
                        updateDob(dobMonth, dobDay, v);
                      }}
                      style={{ textAlign: "center" }}
                    />
                  </div>
                  <input type="hidden" {...register("dateOfBirth")} />
                </Field>
              </motion.div>
            )}

            {currentStep === 1 && (
              <motion.div
                key="step-1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <div style={{ textAlign: "center", marginBottom: 18 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      margin: "0 auto 12px",
                      borderRadius: "50%",
                      background: `${O.a3}15`,
                      border: `1px solid ${O.a3}44`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: O.a3,
                    }}
                  >
                    <Shield style={{ width: 22, height: 22 }} />
                  </div>
                  <p style={{ fontSize: 13, color: O.ink3, margin: 0 }}>
                    Pick a password you&apos;ll remember — long beats clever.
                  </p>
                </div>

                <Field label="Password" error={errors.password?.message}>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    {...register("password")}
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
                <PasswordStrength password={passwordValue} />

                <div style={{ marginTop: 18 }}>
                  <Field label="Confirm password" error={errors.confirmPassword?.message}>
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Repeat your password"
                      {...register("confirmPassword")}
                      suffix={
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                          {showConfirmPassword ? (
                            <EyeOff style={{ width: 15, height: 15 }} />
                          ) : (
                            <Eye style={{ width: 15, height: 15 }} />
                          )}
                        </button>
                      }
                    />
                  </Field>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step-2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <div style={{ textAlign: "center", marginBottom: 18 }}>
                  <p style={{ fontSize: 13, color: O.ink3, margin: 0 }}>
                    Almost in. Add a face and a line.
                  </p>
                </div>

                <div style={{ display: "flex", justifyContent: "center" }}>
                  <div
                    onClick={() => avatarInputRef.current?.click()}
                    style={{ position: "relative", cursor: "pointer" }}
                  >
                    <div
                      style={{
                        width: 96,
                        height: 96,
                        borderRadius: "50%",
                        background: O.glass,
                        border: `1px solid ${O.hair2}`,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <User style={{ width: 36, height: 36, color: O.ink4 }} />
                      )}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        bottom: -4,
                        right: -4,
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: aurora,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        boxShadow: `0 6px 18px ${O.a2}66`,
                      }}
                    >
                      <Camera style={{ width: 12, height: 12 }} />
                    </div>
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleAvatarSelect}
                    className="hidden"
                  />
                </div>
                <p
                  style={{
                    textAlign: "center",
                    fontSize: 11,
                    color: O.ink4,
                    fontFamily: O.mono,
                    letterSpacing: "0.08em",
                    marginTop: 8,
                    marginBottom: 20,
                  }}
                >
                  TAP TO ADD A PHOTO
                </p>

                <Field
                  label="Bio"
                  hint="Optional"
                  error={errors.bio?.message}
                >
                  <TextArea
                    placeholder="Tell us about yourself…"
                    {...register("bio")}
                    rows={3}
                    maxLength={160}
                  />
                </Field>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    marginTop: 8,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    {...register("agreeToTerms")}
                    style={{
                      marginTop: 3,
                      width: 16,
                      height: 16,
                      accentColor: O.a2,
                    }}
                  />
                  <span style={{ fontSize: 12, color: O.ink3, lineHeight: 1.5 }}>
                    I agree to the Terms of Service and Privacy Policy.
                  </span>
                </label>
                {errors.agreeToTerms && (
                  <p style={{ fontSize: 11, color: "#ff7a85", marginTop: 6 }}>
                    {errors.agreeToTerms.message}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 20,
          }}
        >
          {currentStep > 0 && (
            <PillBtn type="button" size="lg" onClick={goBack} style={{ flex: 1, justifyContent: "center" }}>
              <ArrowLeft style={{ width: 14, height: 14 }} />
              Back
            </PillBtn>
          )}
          {currentStep < 2 ? (
            <PillBtn
              primary
              type="button"
              size="lg"
              onClick={goNext}
              style={{ flex: currentStep === 0 ? "1 0 100%" : 1, justifyContent: "center" }}
            >
              Next
              <ArrowRight style={{ width: 14, height: 14 }} />
            </PillBtn>
          ) : (
            <PillBtn
              primary
              type="submit"
              size="lg"
              disabled={isSubmitting || !agreeToTerms}
              style={{ flex: 1, justifyContent: "center" }}
            >
              {isSubmitting ? (
                <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
              ) : (
                "Create account →"
              )}
            </PillBtn>
          )}
        </div>
        <TurnstileWidget ref={turnstileRef} />
      </form>

      <p
        style={{
          marginTop: 24,
          textAlign: "center",
          fontSize: 13,
          color: O.ink3,
        }}
      >
        Already have an account?{" "}
        <Link href="/login" style={{ color: O.a3, textDecoration: "none", fontWeight: 600 }}>
          Sign in →
        </Link>
      </p>
    </Shell>
  );
}
