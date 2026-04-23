"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const GoogleIcon = () => (
  <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

function OrbitLogo() {
  return (
    <div className="relative w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] lg:w-[440px] lg:h-[440px]">
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.623 0.214 259 / 15%) 0%, transparent 70%)",
          animation: "pulse-glow 4s ease-in-out infinite",
        }}
      />

      {/* Outer orbit ring */}
      <div
        className="absolute inset-4 rounded-full border border-white/[0.06]"
        style={{ animation: "orbit-spin 25s linear infinite" }}
      >
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-400/60 shadow-[0_0_12px_oklch(0.623_0.214_259_/_0.6)]" />
      </div>

      {/* Middle orbit ring */}
      <div
        className="absolute inset-12 rounded-full border border-white/[0.04]"
        style={{ animation: "orbit-spin-reverse 18s linear infinite" }}
      >
        <div className="absolute -bottom-1 right-4 w-2 h-2 rounded-full bg-purple-400/50 shadow-[0_0_8px_oklch(0.7_0.2_300_/_0.5)]" />
      </div>

      {/* Inner orbit ring */}
      <div
        className="absolute inset-20 rounded-full border border-white/[0.08]"
        style={{ animation: "orbit-spin 12s linear infinite" }}
      >
        <div className="absolute top-2 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400/40 shadow-[0_0_10px_oklch(0.7_0.15_200_/_0.4)]" />
      </div>

      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-7xl sm:text-8xl lg:text-9xl font-extrabold tracking-tighter"
          style={{
            fontFamily: "var(--font-syne), sans-serif",
            background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.6) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          O
        </motion.span>
      </div>
    </div>
  );
}

const footerLinks = [
  "About", "Terms of Service", "Privacy Policy", "Cookie Policy",
  "Accessibility", "Blog", "Careers", "Brand", "Developers",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Film grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          animation: "grain 8s steps(10) infinite",
        }}
      />

      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-500/[0.03] rounded-full blur-[150px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/[0.02] rounded-full blur-[120px] translate-y-1/3 -translate-x-1/4" />
      </div>

      {/* Main content — split layout */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center relative z-10">
        {/* Left — Logo */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="flex-1 flex items-center justify-center p-8 lg:p-16"
        >
          <OrbitLogo />
        </motion.div>

        {/* Right — Auth CTA */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="w-full lg:w-auto lg:flex-1 flex items-center justify-center lg:justify-start p-8 lg:p-16 lg:max-w-xl"
        >
          <div className="w-full max-w-[380px] space-y-10">
            {/* Tagline */}
            <div className="space-y-4">
              <h1
                className="text-[42px] sm:text-5xl lg:text-[56px] font-extrabold leading-[1.05] tracking-tight"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                Happening<br />now
              </h1>
              <h2
                className="text-2xl sm:text-3xl font-bold text-foreground/90"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                Join today.
              </h2>
            </div>

            {/* Auth buttons */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-11 rounded-full bg-white text-black font-medium text-[15px] border-none hover:bg-white/90 hover:text-black"
                onClick={() => {
                  /* Google OAuth handled on signup/login */
                }}
              >
                <GoogleIcon />
                Sign up with Google
              </Button>

              <div className="flex items-center gap-3 px-1">
                <div className="flex-1 h-px bg-white/[0.12]" />
                <span className="text-sm text-muted-foreground font-medium">or</span>
                <div className="flex-1 h-px bg-white/[0.12]" />
              </div>

              <Link href="/signup" className="block">
                <Button
                  className="w-full h-11 rounded-full text-[15px] font-bold"
                >
                  Create account
                </Button>
              </Link>

              <p className="text-[11px] text-muted-foreground leading-snug pt-1">
                By signing up, you agree to the{" "}
                <span className="text-primary cursor-pointer hover:underline">Terms of Service</span> and{" "}
                <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>, including{" "}
                <span className="text-primary cursor-pointer hover:underline">Cookie Use</span>.
              </p>
            </div>

            {/* Sign in */}
            <div className="space-y-4 pt-2">
              <p className="font-bold text-[17px]" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                Already have an account?
              </p>
              <Link href="/login" className="block">
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-full text-[15px] font-bold text-primary border-white/20 hover:bg-primary/10 hover:border-primary/30"
                >
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-4 px-6">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {footerLinks.map((link) => (
            <span
              key={link}
              className="text-[13px] text-muted-foreground/70 hover:text-muted-foreground cursor-pointer transition-colors"
            >
              {link}
            </span>
          ))}
          <span className="text-[13px] text-muted-foreground/50">
            &copy; 2026 Orbit
          </span>
        </div>
      </footer>
    </div>
  );
}
