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
  Sparkles,
  Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { fullSignUpSchema, type FullSignUpFormData } from "@/lib/utils/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const syne = { fontFamily: "var(--font-syne), sans-serif" };

const GoogleIcon = () => (
  <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const steps = [
  { label: "Account", icon: User },
  { label: "Security", icon: Shield },
  { label: "Optional", icon: Sparkles },
] as const;

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "10+ characters", met: password.length >= 10 },
    { label: "Uppercase", met: /[A-Z]/.test(password) },
    { label: "Lowercase", met: /[a-z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
    { label: "Special char", met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) },
  ];

  if (!password) return null;

  const metCount = checks.filter((c) => c.met).length;
  const strengthPercent = (metCount / checks.length) * 100;
  const strengthColor =
    strengthPercent <= 40
      ? "bg-red-500"
      : strengthPercent <= 70
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="space-y-2.5 pt-1">
      <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${strengthColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${strengthPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {checks.map((c) => (
          <span
            key={c.label}
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
              c.met
                ? "text-emerald-400 bg-emerald-400/10"
                : "text-muted-foreground/50 bg-white/[0.03]"
            }`}
          >
            {c.met ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isCompleted = i < currentStep;
        const isActive = i === currentStep;
        return (
          <div key={step.label} className="flex items-center gap-3">
            {i > 0 && (
              <div
                className={`h-[2px] w-8 rounded-full transition-colors duration-300 ${
                  isCompleted ? "bg-primary" : "bg-white/[0.08]"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "bg-primary/20 text-primary ring-2 ring-primary/40"
                      : "bg-white/[0.05] text-muted-foreground/50"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? "text-foreground" : "text-muted-foreground/50"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SignUpPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [dobMonth, setDobMonth] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobYear, setDobYear] = useState("");
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
  const fullNameValue = watch("fullName", "");
  const usernameValue = watch("username", "");
  const agreeToTerms = watch("agreeToTerms");

  // Auto-generate username from full name
  useEffect(() => {
    if (fullNameValue && !usernameValue) {
      const generated = fullNameValue
        .toLowerCase()
        .replace(/[^a-z0-9\s_]/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 30);
      if (generated.length >= 3) {
        setValue("username", generated);
      }
    }
  }, [fullNameValue, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check username availability with debounce
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
    // Show preview immediately
    setAvatarPreview(URL.createObjectURL(file));
    // Store the file for upload after account creation
    (window as any).__pendingAvatarFile = file;
  };

  const onSubmit = async (data: FullSignUpFormData) => {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/callback?next=/feed`,
        data: {
          // These keys match what the DB trigger reads
          full_name: data.fullName,
          username: data.username.toLowerCase(),
          bio: data.bio || null,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    // Redirect to verify email page
    router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
  };

  const signUpWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) toast.error(error.message);
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 80 : -80,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -80 : 80,
      opacity: 0,
    }),
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden page-gradient">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-blue-500/[0.04] rounded-full blur-[180px]" />
        <div className="absolute bottom-1/3 left-1/4 w-[500px] h-[500px] bg-purple-500/[0.03] rounded-full blur-[150px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[480px] space-y-6 relative z-10"
      >
        {/* Logo */}
        <div className="text-center space-y-2">
          <Link href="/">
            <span
              className="text-5xl font-extrabold tracking-tighter inline-block"
              style={{
                ...syne,
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
            <h1 className="text-xl font-bold" style={syne}>
              Create your account
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Join Orbit today
            </p>
          </div>

          {/* Step indicator */}
          <StepIndicator currentStep={currentStep} />

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="min-h-[320px] relative overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                {/* Step 1: Account */}
                {currentStep === 0 && (
                  <motion.div
                    key="step-0"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-5"
                  >
                    {/* Google button */}
                    <Button
                      type="button"
                      variant="outline"
                      className="btn-social"
                      onClick={signUpWithGoogle}
                    >
                      <GoogleIcon />
                      Sign up with Google
                    </Button>

                    <div className="divider-text">
                      <span className="text-xs text-muted-foreground/60 uppercase tracking-wider font-medium px-2">
                        or
                      </span>
                    </div>

                    {/* Display Name */}
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-[13px] text-muted-foreground font-medium">
                        Display Name
                      </Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="How others will see you"
                        {...register("fullName")}
                        className="input-premium"
                      />
                      {errors.fullName && (
                        <p className="text-xs text-destructive mt-1">{errors.fullName.message}</p>
                      )}
                    </div>

                    {/* Username */}
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-[13px] text-muted-foreground font-medium">
                        Username
                      </Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-sm">
                          @
                        </span>
                        <Input
                          id="username"
                          type="text"
                          placeholder="username"
                          {...register("username")}
                          className="input-premium pl-8"
                        />
                        {checkingUsername && (
                          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground/50" />
                        )}
                        {!checkingUsername && usernameAvailable === true && usernameValue.length >= 3 && (
                          <Check className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                        )}
                        {!checkingUsername && usernameAvailable === false && (
                          <X className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400" />
                        )}
                      </div>
                      {usernameAvailable === false && (
                        <p className="text-xs text-destructive mt-1">This username is taken</p>
                      )}
                      {errors.username && (
                        <p className="text-xs text-destructive mt-1">{errors.username.message}</p>
                      )}
                    </div>

                    {/* Email */}
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
                      />
                      {errors.email && (
                        <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
                      )}
                    </div>

                    {/* Date of Birth — typed inputs */}
                    <div className="space-y-2">
                      <Label className="text-[13px] text-muted-foreground font-medium">
                        Date of Birth
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="MM"
                          maxLength={2}
                          value={dobMonth}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                            setDobMonth(v);
                            updateDob(v.padStart(2, "0"), dobDay.padStart(2, "0"), dobYear);
                          }}
                          className="input-premium text-center text-sm"
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
                            updateDob(dobMonth.padStart(2, "0"), v.padStart(2, "0"), dobYear);
                          }}
                          className="input-premium text-center text-sm"
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
                            updateDob(dobMonth.padStart(2, "0"), dobDay.padStart(2, "0"), v);
                          }}
                          className="input-premium text-center text-sm"
                        />
                      </div>
                      <input type="hidden" {...register("dateOfBirth")} />
                      {errors.dateOfBirth && (
                        <p className="text-xs text-destructive mt-1">{errors.dateOfBirth.message}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground/50">You must be at least 13 years old</p>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Security */}
                {currentStep === 1 && (
                  <motion.div
                    key="step-1"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-5"
                  >
                    <div className="text-center pb-2">
                      <Shield className="h-8 w-8 mx-auto text-primary/60 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Choose a strong password to protect your account
                      </p>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-[13px] text-muted-foreground font-medium">
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a strong password"
                          {...register("password")}
                          className="input-premium pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <PasswordStrength password={passwordValue} />
                      {errors.password && (
                        <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-[13px] text-muted-foreground font-medium">
                        Confirm Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Repeat your password"
                          {...register("confirmPassword")}
                          className="input-premium pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-xs text-destructive mt-1">{errors.confirmPassword.message}</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Optional */}
                {currentStep === 2 && (
                  <motion.div
                    key="step-2"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-5"
                  >
                    <div className="text-center pb-2">
                      <p className="text-sm text-muted-foreground">
                        Almost done! Add a photo and bio.
                      </p>
                    </div>

                    {/* Profile Picture */}
                    <div className="flex justify-center">
                      <div
                        className="relative cursor-pointer group"
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        <div className="h-24 w-24 rounded-full bg-white/[0.04] border-2 border-white/[0.08] flex items-center justify-center overflow-hidden">
                          {avatarPreview ? (
                            <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-10 w-10 text-muted-foreground/30" />
                          )}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="h-5 w-5 text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center border-2 border-background">
                          <Camera className="h-3 w-3 text-white" />
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
                    <p className="text-center text-xs text-muted-foreground/50">
                      Tap to add a profile photo
                    </p>

                    {/* Bio */}
                    <div className="space-y-2">
                      <Label htmlFor="bio" className="text-[13px] text-muted-foreground font-medium">
                        Bio
                        <span className="text-muted-foreground/40 ml-1">(optional)</span>
                      </Label>
                      <Textarea
                        id="bio"
                        placeholder="Tell us about yourself..."
                        {...register("bio")}
                        className="input-premium min-h-24 resize-none"
                        maxLength={160}
                      />
                      {errors.bio && (
                        <p className="text-xs text-destructive mt-1">{errors.bio.message}</p>
                      )}
                    </div>

                    {/* Terms checkbox */}
                    <label className="flex items-start gap-3 cursor-pointer group pt-2">
                      <input
                        type="checkbox"
                        {...register("agreeToTerms")}
                        className="mt-0.5 h-4 w-4 rounded border-white/10 bg-white/[0.05] text-primary focus:ring-primary/30 accent-primary"
                      />
                      <span className="text-[12px] text-muted-foreground leading-snug">
                        I agree to the{" "}
                        <span className="text-primary cursor-pointer hover:underline">Terms of Service</span>
                        {" "}and{" "}
                        <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>.
                        You must be at least 13 years old to use Orbit.
                      </span>
                    </label>
                    {errors.agreeToTerms && (
                      <p className="text-xs text-destructive">{errors.agreeToTerms.message}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-3 pt-2">
              {currentStep > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 rounded-full text-[15px] font-semibold"
                  onClick={goBack}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}

              {currentStep < 2 ? (
                <Button
                  type="button"
                  className={`h-12 rounded-full text-[15px] font-bold bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all ${
                    currentStep === 0 ? "w-full" : "flex-1"
                  }`}
                  onClick={goNext}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="flex-1 h-12 rounded-full text-[15px] font-bold bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                  disabled={isSubmitting || !agreeToTerms}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Create Account"
                  )}
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Footer link */}
        <div className="card-elevated p-5">
          <p className="text-center text-[15px] text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
