"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { signUpSchema, type SignUpFormData } from "@/lib/utils/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GoogleIcon = () => (
  <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

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
      {/* Strength bar */}
      <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${strengthColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${strengthPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      {/* Checks */}
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

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const passwordValue = watch("password", "");

  const onSubmit = async (data: SignUpFormData) => {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Check your email to confirm your account!");
    router.push("/login");
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
              Create your account
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Join Orbit today
            </p>
          </div>

          {/* Google button */}
          <Button
            variant="outline"
            className="btn-social"
            onClick={signUpWithGoogle}
          >
            <GoogleIcon />
            Sign up with Google
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
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
              )}
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[13px] text-muted-foreground font-medium">
                Confirm password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                {...register("confirmPassword")}
                className="input-premium"
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-full text-[15px] font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign Up"}
            </Button>

            <p className="text-[11px] text-muted-foreground/50 leading-snug text-center">
              By signing up, you agree to our{" "}
              <span className="text-primary cursor-pointer hover:underline">Terms</span> and{" "}
              <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>.
            </p>
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
