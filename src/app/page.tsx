"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  useSpring,
  useScroll,
} from "framer-motion";
import {
  Newspaper,
  Clapperboard,
  MessageCircle,
  Users,
  Zap,
  Shield,
  Heart,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ─── Helpers ──────────────────────────────────────────── */

const syne = { fontFamily: "var(--font-syne), sans-serif" };

const GoogleIcon = () => (
  <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 50, damping: 20 });
  const display = useTransform(spring, (v) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return Math.round(v).toString();
  });

  const [text, setText] = useState("0");

  useEffect(() => {
    if (isInView) motionVal.set(target);
  }, [isInView, target, motionVal]);

  useEffect(() => {
    const unsub = display.on("change", (v) => setText(v));
    return unsub;
  }, [display]);

  return (
    <span ref={ref}>
      {text}
      {suffix}
    </span>
  );
}

/* ─── Section: Reveal wrapper ──────────────────────────── */

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Section 1: Hero ──────────────────────────────────── */

function HeroOrbit() {
  return (
    <div className="relative w-[300px] h-[300px] sm:w-[380px] sm:h-[380px] lg:w-[480px] lg:h-[480px]">
      {/* Deep glow */}
      <div
        className="absolute -inset-20 rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.623 0.214 259 / 12%) 0%, oklch(0.7 0.2 300 / 5%) 30%, transparent 65%)",
          animation: "pulse-glow 5s ease-in-out infinite",
        }}
      />

      {/* Ring 1 — outermost, very faint */}
      <div
        className="absolute -inset-2 rounded-full border border-white/[0.03]"
        style={{ animation: "orbit-spin 40s linear infinite" }}
      >
        <div className="absolute -top-1 left-1/3 w-1.5 h-1.5 rounded-full bg-blue-300/30" />
      </div>

      {/* Ring 2 */}
      <div
        className="absolute inset-4 rounded-full border border-white/[0.06]"
        style={{ animation: "orbit-spin 28s linear infinite" }}
      >
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-blue-400/60 shadow-[0_0_20px_8px_oklch(0.623_0.214_259_/_0.4)]" />
      </div>

      {/* Ring 3 */}
      <div
        className="absolute inset-14 rounded-full border border-white/[0.05]"
        style={{ animation: "orbit-spin-reverse 20s linear infinite" }}
      >
        <div className="absolute -bottom-1.5 right-8 w-3 h-3 rounded-full bg-purple-400/50 shadow-[0_0_14px_6px_oklch(0.7_0.2_300_/_0.35)]" />
      </div>

      {/* Ring 4 */}
      <div
        className="absolute inset-24 rounded-full border border-white/[0.08]"
        style={{ animation: "orbit-spin 14s linear infinite" }}
      >
        <div className="absolute top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-cyan-400/45 shadow-[0_0_12px_4px_oklch(0.7_0.15_200_/_0.3)]" />
      </div>

      {/* Ring 5 — innermost */}
      <div
        className="absolute inset-32 sm:inset-36 lg:inset-40 rounded-full border border-white/[0.1]"
        style={{ animation: "orbit-spin-reverse 10s linear infinite" }}
      >
        <div className="absolute -top-1 left-1/2 w-2 h-2 rounded-full bg-white/30" />
      </div>

      {/* Center letter */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-8xl sm:text-9xl lg:text-[150px] font-extrabold tracking-[-0.06em] select-none"
          style={{
            ...syne,
            background: "linear-gradient(180deg, #fff 20%, rgba(255,255,255,0.35) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          O
        </span>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col lg:flex-row items-center justify-center overflow-hidden">
      {/* BG effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-blue-500/[0.05] rounded-full blur-[200px] -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-purple-500/[0.03] rounded-full blur-[180px] translate-y-1/2 translate-x-1/3" />
      </div>

      {/* Left — logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 flex items-center justify-center p-8 lg:p-0 lg:pr-8"
      >
        <HeroOrbit />
      </motion.div>

      {/* Right — CTA */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 flex items-center justify-center lg:justify-start px-6 pb-16 lg:pb-0 lg:pl-8 lg:max-w-xl"
      >
        <div className="w-full max-w-[420px] space-y-10">
          {/* Headline */}
          <div>
            <h1
              className="text-5xl sm:text-6xl lg:text-[68px] font-extrabold leading-[1.02] tracking-[-0.03em]"
              style={syne}
            >
              Your world.
              <br />
              <span className="text-gradient">Your orbit.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground/80 leading-relaxed max-w-sm">
              The social platform where real connections happen. Share, discover, and
              build communities — on your terms.
            </p>
          </div>

          {/* Auth buttons */}
          <div className="space-y-3.5">
            <Button variant="outline" className="btn-social">
              <GoogleIcon />
              Sign up with Google
            </Button>

            <div className="divider-text">
              <span className="text-xs text-muted-foreground/50 uppercase tracking-widest font-medium px-3">
                or
              </span>
            </div>

            <Link href="/signup" className="block">
              <Button className="w-full h-12 rounded-full text-[15px] font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30">
                Create account
              </Button>
            </Link>

            <p className="text-[11px] text-muted-foreground/40 leading-snug text-center pt-1">
              By signing up, you agree to the{" "}
              <span className="text-muted-foreground/60 hover:text-primary cursor-pointer">Terms</span>,{" "}
              <span className="text-muted-foreground/60 hover:text-primary cursor-pointer">Privacy</span>, and{" "}
              <span className="text-muted-foreground/60 hover:text-primary cursor-pointer">Cookie</span> policies.
            </p>
          </div>

          {/* Sign in */}
          <div className="pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold" style={syne}>
                Have an account?
              </p>
              <Link href="/login">
                <Button
                  variant="outline"
                  className="h-10 rounded-full px-6 text-sm font-bold text-primary border-white/10 hover:bg-primary/10 hover:border-primary/30"
                >
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2"
      >
        <span className="text-xs text-muted-foreground/40 tracking-wider uppercase">Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          className="w-5 h-8 rounded-full border border-white/10 flex justify-center pt-1.5"
        >
          <div className="w-1 h-2 rounded-full bg-white/30" />
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ─── Section 2: Features ──────────────────────────────── */

const features = [
  {
    icon: Newspaper,
    title: "Feed & Stories",
    desc: "Share moments that matter. A beautiful, algorithmic feed with ephemeral stories that disappear in 24 hours.",
    gradient: "from-blue-500/20 to-cyan-500/10",
    iconColor: "text-blue-400",
  },
  {
    icon: Clapperboard,
    title: "Reels",
    desc: "Create and discover short-form videos. Full-screen, immersive, endlessly scrollable.",
    gradient: "from-purple-500/20 to-pink-500/10",
    iconColor: "text-purple-400",
  },
  {
    icon: MessageCircle,
    title: "Messaging",
    desc: "Real-time conversations. Send text, media, and reactions — with read receipts and typing indicators.",
    gradient: "from-emerald-500/20 to-teal-500/10",
    iconColor: "text-emerald-400",
  },
  {
    icon: Users,
    title: "Communities",
    desc: "Find your people. Join or create communities around shared interests, with dedicated feeds and moderation.",
    gradient: "from-amber-500/20 to-orange-500/10",
    iconColor: "text-amber-400",
  },
];

function FeaturesSection() {
  return (
    <section className="relative py-32 lg:py-40 overflow-hidden">
      {/* BG glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-primary/[0.03] rounded-full blur-[200px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-20">
            <p className="text-primary text-sm font-semibold tracking-widest uppercase mb-4">
              Everything you need
            </p>
            <h2
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.02em] leading-[1.08]"
              style={syne}
            >
              One platform.
              <br />
              Endless possibilities.
            </h2>
            <p className="mt-5 text-lg text-muted-foreground/70 leading-relaxed max-w-lg mx-auto">
              Everything the top social platforms offer — built into one seamless experience.
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 gap-5">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.1}>
              <div className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 sm:p-10 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-500">
                {/* Gradient accent */}
                <div
                  className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl ${f.gradient} rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`}
                />

                <div className="relative z-10">
                  <div
                    className={`w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-5 ${f.iconColor} group-hover:scale-110 transition-transform duration-500`}
                  >
                    <f.icon className="h-6 w-6" />
                  </div>

                  <h3 className="text-xl font-bold mb-2.5" style={syne}>
                    {f.title}
                  </h3>
                  <p className="text-muted-foreground/70 leading-relaxed text-[15px]">
                    {f.desc}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section 3: Stats ──────────────────────────────────── */

const stats = [
  { value: 10_000_000, label: "Posts shared", suffix: "+" },
  { value: 500_000, label: "Active users", suffix: "+" },
  { value: 50_000, label: "Communities", suffix: "+" },
  { value: 99.9, label: "Uptime", suffix: "%" },
];

function StatsSection() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="absolute inset-0 border-y border-white/[0.04]" />

      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <div className="text-center">
                <div
                  className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold tracking-tight"
                  style={syne}
                >
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground/60 uppercase tracking-wider font-medium">
                  {s.label}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section 4: Platform Highlights ────────────────────── */

const highlights = [
  {
    icon: Zap,
    title: "Blazing fast",
    desc: "Built on cutting-edge infrastructure. Every interaction feels instant.",
  },
  {
    icon: Shield,
    title: "Privacy first",
    desc: "Your data belongs to you. End-to-end encryption. Full control over your visibility.",
  },
  {
    icon: Heart,
    title: "Creator-friendly",
    desc: "Analytics, monetization tools, and audience insights — built for creators who mean business.",
  },
  {
    icon: TrendingUp,
    title: "Smart discovery",
    desc: "An algorithm that works for you. Trending topics, personalized feeds, and explore pages.",
  },
];

function HighlightsSection() {
  return (
    <section className="relative py-32 lg:py-40 overflow-hidden">
      <div className="absolute bottom-0 left-1/4 w-[700px] h-[400px] bg-primary/[0.03] rounded-full blur-[180px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-20">
            <p className="text-primary text-sm font-semibold tracking-widest uppercase mb-4">
              Why Orbit
            </p>
            <h2
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.02em] leading-[1.08]"
              style={syne}
            >
              Built different.
            </h2>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {highlights.map((h, i) => (
            <Reveal key={h.title} delay={i * 0.08}>
              <div className="text-center group">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/10 group-hover:border-primary/20 transition-all duration-500">
                  <h.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors duration-500" />
                </div>
                <h3 className="text-lg font-bold mb-2" style={syne}>
                  {h.title}
                </h3>
                <p className="text-sm text-muted-foreground/60 leading-relaxed">
                  {h.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section 5: App preview ────────────────────────────── */

function AppPreviewSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [60, -60]);

  return (
    <section ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-4xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-16">
            <h2
              className="text-4xl sm:text-5xl font-extrabold tracking-[-0.02em]"
              style={syne}
            >
              See it in action
            </h2>
            <p className="mt-4 text-muted-foreground/60 text-lg">
              A glimpse of what awaits you inside Orbit.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <motion.div style={{ y }} className="relative">
            {/* Mock app frame */}
            <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/40">
              {/* Top bar */}
              <div className="flex items-center gap-2 px-6 py-4 border-b border-white/[0.06]">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1.5 rounded-lg bg-white/[0.04] text-xs text-muted-foreground/50 font-mono">
                    orbit.social/feed
                  </div>
                </div>
              </div>

              {/* Mock content */}
              <div className="p-6 sm:p-8 space-y-4">
                {/* Mock post 1 */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/40 to-purple-500/40" />
                    <div>
                      <div className="h-3.5 w-24 rounded bg-white/20" />
                      <div className="h-2.5 w-16 rounded bg-white/10 mt-1.5" />
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-3 w-full rounded bg-white/10" />
                    <div className="h-3 w-3/4 rounded bg-white/10" />
                  </div>
                  <div className="h-48 rounded-xl bg-gradient-to-br from-primary/20 via-purple-500/10 to-transparent" />
                  <div className="flex gap-8 mt-4">
                    <div className="h-3 w-10 rounded bg-white/8" />
                    <div className="h-3 w-10 rounded bg-white/8" />
                    <div className="h-3 w-10 rounded bg-white/8" />
                  </div>
                </div>

                {/* Mock post 2 */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/40 to-cyan-500/40" />
                    <div>
                      <div className="h-3.5 w-20 rounded bg-white/20" />
                      <div className="h-2.5 w-14 rounded bg-white/10 mt-1.5" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded bg-white/10" />
                    <div className="h-3 w-1/2 rounded bg-white/10" />
                  </div>
                  <div className="flex gap-8 mt-4">
                    <div className="h-3 w-10 rounded bg-white/8" />
                    <div className="h-3 w-10 rounded bg-white/8" />
                    <div className="h-3 w-10 rounded bg-white/8" />
                  </div>
                </div>
              </div>
            </div>

            {/* Floating glow behind */}
            <div className="absolute -inset-10 -z-10 rounded-[40px] bg-gradient-to-b from-primary/10 via-transparent to-purple-500/5 blur-[60px]" />
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Section 6: CTA Banner ─────────────────────────────── */

function CTASection() {
  return (
    <section className="relative py-32 lg:py-40 overflow-hidden">
      {/* Big glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/[0.08] rounded-full blur-[200px] pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <Reveal>
          <h2
            className="text-4xl sm:text-5xl lg:text-[64px] font-extrabold tracking-[-0.03em] leading-[1.05]"
            style={syne}
          >
            Ready to join
            <br />
            <span className="text-gradient">the orbit?</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground/60 max-w-md mx-auto leading-relaxed">
            Your community is waiting. Start connecting with people who share
            your passions.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button className="h-13 rounded-full px-10 text-base font-bold shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40">
                Get started — it&apos;s free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/explore">
              <Button
                variant="outline"
                className="h-13 rounded-full px-10 text-base font-bold border-white/10 hover:bg-white/[0.04]"
              >
                Explore first
              </Button>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Footer ────────────────────────────────────────────── */

const footerCols = [
  {
    title: "Product",
    links: ["Feed", "Reels", "Stories", "Messaging", "Communities", "Marketplace"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Blog", "Brand"],
  },
  {
    title: "Legal",
    links: ["Terms of Service", "Privacy Policy", "Cookie Policy", "Accessibility"],
  },
  {
    title: "Developers",
    links: ["API", "Documentation", "Status"],
  },
];

function Footer() {
  return (
    <footer className="relative border-t border-white/[0.05] pt-16 pb-8 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 mb-16">
          {footerCols.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold mb-4 text-foreground/80" style={syne}>
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <span className="text-sm text-muted-foreground/50 hover:text-muted-foreground cursor-pointer transition-colors">
                      {link}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/[0.04]">
          <div className="flex items-center gap-3">
            <span
              className="text-xl font-extrabold tracking-tighter"
              style={{
                ...syne,
                background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.4) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Orbit
            </span>
            <span className="text-xs text-muted-foreground/30">
              &copy; {new Date().getFullYear()} All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ──────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden bg-[oklch(0.07_0_0)]">
      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.018]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          animation: "grain 8s steps(10) infinite",
        }}
      />

      <HeroSection />
      <FeaturesSection />
      <StatsSection />
      <AppPreviewSection />
      <HighlightsSection />
      <CTASection />
      <Footer />
    </div>
  );
}
