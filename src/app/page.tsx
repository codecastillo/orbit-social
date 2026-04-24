"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  useSpring,
} from "framer-motion";
import { ArrowRight } from "lucide-react";
import { O, aurora, auroraSoft, orbitBg, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";

/* ─── Shared: Reveal on scroll ──────────────────────────────────── */

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Animated counter ──────────────────────────────────────────── */

function AnimatedNumber({
  target,
  suffix = "",
  format,
}: {
  target: number;
  suffix?: string;
  format?: (v: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 55, damping: 22 });
  const [text, setText] = useState("0");

  useEffect(() => {
    if (isInView) mv.set(target);
  }, [isInView, target, mv]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      if (format) setText(format(v));
      else if (v >= 1_000_000) setText(`${(v / 1_000_000).toFixed(1)}M`);
      else if (v >= 1_000) setText(`${Math.round(v / 1_000)}K`);
      else setText(v.toFixed(target < 100 ? 2 : 0));
    });
    return unsub;
  }, [spring, format, target]);

  return (
    <span ref={ref}>
      {text}
      {suffix}
    </span>
  );
}

/* ─── Top nav ───────────────────────────────────────────────────── */

function TopNav() {
  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        background: "rgba(7,8,24,0.6)",
        borderBottom: `1px solid ${O.hair}`,
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "0 28px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 28,
              height: 28,
              borderRadius: 8,
              background: aurora,
              boxShadow: `0 4px 14px -2px ${O.a2}80, inset 0 1px 0 rgba(255,255,255,0.3)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 3,
                borderRadius: 5,
                border: "1.5px solid rgba(255,255,255,0.5)",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: O.ink,
            }}
          >
            Orbit
          </span>
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            color: O.ink2,
            fontSize: 13,
            fontWeight: 500,
          }}
          className="hidden md:flex"
        >
          {["Products", "Ecosystem", "Pricing", "Manifesto", "Help"].map((l) => (
            <span key={l} style={{ cursor: "pointer" }}>
              {l}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/login"
            style={{ color: O.ink2, fontSize: 13, fontWeight: 500, textDecoration: "none" }}
          >
            Sign in
          </Link>
          <Link href="/signup">
            <PillBtn primary size="sm">
              Get started
            </PillBtn>
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ─── Hero ──────────────────────────────────────────────────────── */

function HeroOrbit() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1/1",
        maxWidth: 520,
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          inset: "-15%",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${O.a1}25 0%, ${O.a2}15 35%, transparent 65%)`,
          filter: "blur(20px)",
          animation: "pulse-glow 5s ease-in-out infinite",
        }}
      />

      {/* Orbit rings with dots */}
      {[
        { inset: "6%", dur: 40, size: 6, color: O.a1, angle: 120 },
        { inset: "16%", dur: 28, size: 10, color: O.a2, angle: 60 },
        { inset: "28%", dur: 20, size: 7, color: O.a3, angle: 200, reverse: true },
        { inset: "40%", dur: 14, size: 5, color: O.a2, angle: 310 },
      ].map((r, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: r.inset,
            borderRadius: "50%",
            border: `1px solid ${O.hair2}`,
            animation: `orbit-spin ${r.dur}s linear infinite ${r.reverse ? "reverse" : ""}`,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -r.size / 2,
              left: "50%",
              transform: `translateX(-50%) rotate(${r.angle}deg)`,
              transformOrigin: "center bottom",
              width: r.size,
              height: r.size,
              borderRadius: "50%",
              background: r.color,
              boxShadow: `0 0 14px 2px ${r.color}`,
            }}
          />
        </div>
      ))}

      {/* Center planet */}
      <div
        style={{
          position: "absolute",
          inset: "42%",
          borderRadius: "50%",
          background: aurora,
          boxShadow: `0 0 60px ${O.a2}66, 0 0 120px ${O.a1}33, inset 0 2px 0 rgba(255,255,255,0.3)`,
        }}
      />
    </div>
  );
}

function HeroSection() {
  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        paddingTop: 96,
        paddingBottom: 64,
        position: "relative",
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "0 28px",
          width: "100%",
          display: "grid",
          gap: 48,
          alignItems: "center",
        }}
        className="md:grid-cols-2 grid-cols-1"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{ marginBottom: 18 }}>
            <Eyebrow>◇&nbsp;&nbsp;ORBIT · EVERYONE&apos;S RADIUS</Eyebrow>
          </div>
          <Display size={76}>
            The internet,
            <br />
            but <Acc>smaller</Acc>.
          </Display>
          <p
            style={{
              fontSize: 16,
              color: O.ink3,
              marginTop: 22,
              lineHeight: 1.6,
              maxWidth: 460,
            }}
          >
            A social platform built for people who are tired of shouting into the void. Start
            with one room, one post, one voice note. Strangers find your orbit — or don&apos;t.
          </p>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 32,
              flexWrap: "wrap",
            }}
          >
            <Link href="/signup">
              <PillBtn primary size="lg">
                Get started — it&apos;s free
                <ArrowRight style={{ width: 14, height: 14 }} />
              </PillBtn>
            </Link>
            <PillBtn size="lg">Sign in with Google</PillBtn>
          </div>
          <div
            style={{
              marginTop: 20,
              fontSize: 11,
              color: O.ink4,
              fontFamily: O.mono,
              letterSpacing: "0.1em",
            }}
          >
            NO CREDIT CARD · 30-SEC SETUP · DELETE ANYTIME
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: "flex", justifyContent: "center" }}
        >
          <HeroOrbit />
        </motion.div>
      </div>
    </section>
  );
}

/* ─── One platform. All the surface. — bento ───────────────────── */

function BentoSection() {
  return (
    <section style={{ padding: "120px 0 80px", position: "relative" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px" }}>
        <Reveal>
          <Eyebrow>◈&nbsp;&nbsp;WHAT YOU GET</Eyebrow>
          <Display size={64} style={{ marginTop: 14, marginBottom: 20 }}>
            One <Acc>platform</Acc>. All the <Acc>surface</Acc>.
          </Display>
          <p style={{ fontSize: 15, color: O.ink3, maxWidth: 560, lineHeight: 1.55 }}>
            Feed, clips, audio, rooms, events — the four core surfaces every social network
            needs, built into one cohesive system.
          </p>
        </Reveal>

        <div
          style={{
            marginTop: 56,
            display: "grid",
            gridTemplateColumns: "1fr 1.4fr",
            gap: 16,
          }}
          className="lg:grid-cols-[1fr_1.4fr] grid-cols-1"
        >
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Reveal delay={0.05}>
              <BentoCard
                title="Feed & Moments"
                sub="Share what matters. A personalized feed with ephemeral Moments that vanish in 24h."
                tone="dim"
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <MiniPostRow color={O.a1} />
                  <MiniPostRow color={O.a2} />
                </div>
              </BentoCard>
            </Reveal>

            <Reveal delay={0.1}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <BentoCard title="Rooms" sub="Small places. Loud enough." compact>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 4,
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ aspectRatio: "1/1", background: "linear-gradient(135deg,#ff6a7a,#c8435a)" }} />
                    <div style={{ aspectRatio: "1/1", background: "linear-gradient(135deg,#ff9a3d,#ff5a6a)" }} />
                    <div style={{ aspectRatio: "1/1", background: "linear-gradient(135deg,#8b73ff,#5f4bd0)" }} />
                    <div style={{ aspectRatio: "1/1", background: "linear-gradient(135deg,#4dd694,#2d9e67)" }} />
                  </div>
                </BentoCard>
                <BentoCard title="Live" sub="Go on air in one tap." compact>
                  <div
                    style={{
                      position: "relative",
                      borderRadius: 10,
                      aspectRatio: "1/0.9",
                      background: `linear-gradient(135deg, ${O.a2}, ${O.a1})`,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        padding: "3px 7px",
                        background: "#ff5a6a",
                        borderRadius: 99,
                        fontSize: 8.5,
                        fontFamily: O.mono,
                        letterSpacing: "0.1em",
                        fontWeight: 700,
                        color: "white",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "white" }} />
                      LIVE
                    </div>
                  </div>
                </BentoCard>
              </div>
            </Reveal>
          </div>

          {/* Right — Clips big */}
          <Reveal delay={0.15}>
            <BentoCard
              title="Clips"
              sub="Short video, long attention. Vertical, snap-scroll, tuned for making — not doomscrolling."
              tall
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginTop: 16,
                }}
              >
                {[
                  "linear-gradient(135deg,#ff6a7a 0%,#c8435a 100%)",
                  "linear-gradient(135deg,#4dc4ff 0%,#2d6fe0 100%)",
                  "linear-gradient(135deg,#8b73ff 0%,#ba6aff 100%)",
                  "linear-gradient(135deg,#4dd694 0%,#2d9e67 100%)",
                ].map((bg, i) => (
                  <div
                    key={i}
                    style={{
                      aspectRatio: "4/3",
                      borderRadius: 12,
                      background: bg,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        bottom: 8,
                        left: 10,
                        fontSize: 9.5,
                        fontFamily: O.mono,
                        letterSpacing: "0.06em",
                        color: "rgba(255,255,255,0.75)",
                      }}
                    >
                      [ clip {i + 1} ]
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>
          </Reveal>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
          className="grid-cols-1 sm:grid-cols-2"
        >
          <Reveal delay={0.2}>
            <BentoCard
              title="Events"
              sub="Meetups, launches, listening sessions. The real-world side of the network."
              compact
            />
          </Reveal>
          <Reveal delay={0.25}>
            <BentoCard
              title="Audio posts"
              sub="Record voice notes with waveforms. Speak instead of typing, when it matters."
              compact
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function BentoCard({
  title,
  sub,
  children,
  compact,
  tall,
  tone = "normal",
}: {
  title: string;
  sub: string;
  children?: React.ReactNode;
  compact?: boolean;
  tall?: boolean;
  tone?: "normal" | "dim";
}) {
  return (
    <div
      style={{
        ...panel(),
        padding: compact ? 22 : 26,
        minHeight: tall ? 520 : compact ? 180 : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        background: tone === "dim" ? "rgba(255,255,255,0.025)" : O.glass,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div>
        <h3
          style={{
            fontSize: compact ? 17 : 22,
            fontWeight: 700,
            letterSpacing: "-0.015em",
            color: O.ink,
            margin: 0,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: compact ? 12.5 : 13.5,
            color: O.ink3,
            marginTop: 8,
            lineHeight: 1.55,
            maxWidth: 400,
          }}
        >
          {sub}
        </p>
      </div>
      {children}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 12,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: O.ink3,
          fontSize: 11.5,
          fontFamily: O.mono,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Look in <ArrowRight style={{ width: 11, height: 11 }} />
      </div>
    </div>
  );
}

function MiniPostRow({ color }: { color: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: 10,
        borderRadius: 12,
        background: O.glass,
        border: `1px solid ${O.hair}`,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${color}, ${O.a3})`,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ height: 7, borderRadius: 3, background: "rgba(255,255,255,0.12)", width: "70%" }} />
        <div style={{ height: 5, borderRadius: 2, background: "rgba(255,255,255,0.06)", width: "50%" }} />
      </div>
    </div>
  );
}

/* ─── Feed in motion mockup ─────────────────────────────────────── */

function FeedInMotionSection() {
  return (
    <section style={{ padding: "80px 0 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <Display size={56}>
              The feed, <Acc>in motion</Acc>.
            </Display>
            <p
              style={{
                fontSize: 15,
                color: O.ink3,
                marginTop: 16,
                maxWidth: 520,
                margin: "16px auto 0",
                lineHeight: 1.55,
              }}
            >
              A real app. Not a mockup. No autoplay, no forced accelerations. No renewing.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div
            style={{
              ...panel({ borderRadius: 20 }),
              padding: 0,
              overflow: "hidden",
            }}
          >
            {/* Browser chrome */}
            <div
              style={{
                padding: "14px 18px",
                borderBottom: `1px solid ${O.hair}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", gap: 7 }}>
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff6a6a" }} />
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ffbd2e" }} />
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#28ca42" }} />
              </div>
              <div
                style={{
                  marginLeft: 18,
                  padding: "5px 14px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${O.hair}`,
                  fontSize: 11,
                  color: O.ink3,
                  fontFamily: O.mono,
                  letterSpacing: "0.04em",
                }}
              >
                orbit.so/feed
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr 260px",
                minHeight: 440,
              }}
              className="md:grid-cols-[180px_1fr_260px] grid-cols-1"
            >
              {/* Rail */}
              <div style={{ borderRight: `1px solid ${O.hair}`, padding: 16 }}>
                {["Home", "Discover", "Rooms", "Live", "Events", "Messages"].map((l, i) => (
                  <div
                    key={l}
                    style={{
                      padding: "9px 12px",
                      fontSize: 12.5,
                      color: i === 0 ? O.ink : O.ink3,
                      background: i === 0 ? auroraSoft : "transparent",
                      border: `1px solid ${i === 0 ? O.hair2 : "transparent"}`,
                      borderRadius: 10,
                      marginBottom: 2,
                      fontWeight: i === 0 ? 600 : 500,
                    }}
                  >
                    {l}
                  </div>
                ))}
              </div>

              {/* Feed */}
              <div style={{ padding: 20 }}>
                <div
                  style={{
                    aspectRatio: "16/10",
                    borderRadius: 14,
                    background:
                      "linear-gradient(135deg,#ff6a7a 0%,#ff4a40 35%,#c8435a 100%)",
                    position: "relative",
                    overflow: "hidden",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 20px, transparent 20px 40px)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 14,
                      left: 16,
                      fontSize: 11,
                      fontFamily: O.mono,
                      color: "rgba(255,255,255,0.7)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    [ photo · harbour, 17:42 ]
                  </div>
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 14, color: O.ink3, fontSize: 12 }}>
                  <span>♥ 1.3k</span>
                  <span>◌ 42</span>
                  <span>↻ 18</span>
                </div>
              </div>

              {/* Right rail */}
              <div style={{ borderLeft: `1px solid ${O.hair}`, padding: 18 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: O.mono,
                    letterSpacing: "0.12em",
                    color: O.ink3,
                    textTransform: "uppercase",
                    marginBottom: 12,
                  }}
                >
                  ◈ Trending
                </div>
                {["softlaunch", "sundaybest", "analoglife"].map((t, i) => (
                  <div
                    key={t}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "7px 0",
                      borderTop: i ? `1px solid ${O.hair}` : "none",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: O.serif,
                        fontStyle: "italic",
                        fontSize: 17,
                        color: i === 0 ? O.a2 : O.ink3,
                        width: 18,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 12, color: O.ink, fontWeight: 600 }}>
                      #{t}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Built different ──────────────────────────────────────────── */

const pillars = [
  {
    no: "01",
    title: "Fast",
    desc: "Interactions land in <50ms. Scrolling is the point; friction is the enemy.",
  },
  {
    no: "02",
    title: "Private",
    desc: "Your data is yours. E2E where it matters. Visibility you control, not inferred.",
  },
  {
    no: "03",
    title: "For makers",
    desc: "Analytics, monetization, and audience tools — built in, not bolted on.",
  },
  {
    no: "04",
    title: "Discovery",
    desc: "An algorithm that works for you. Trending without trending toward outrage.",
  },
];

function BuiltDifferentSection() {
  return (
    <section style={{ padding: "80px 0" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px" }}>
        <Reveal>
          <Display size={64}>
            Built <Acc>different</Acc>.
          </Display>
        </Reveal>

        <div
          style={{
            marginTop: 48,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 28,
          }}
          className="md:grid-cols-4 sm:grid-cols-2 grid-cols-1"
        >
          {pillars.map((p, i) => (
            <Reveal key={p.no} delay={i * 0.08}>
              <div
                style={{
                  borderTop: `1px solid ${O.hair2}`,
                  paddingTop: 22,
                }}
              >
                <div
                  style={{
                    fontFamily: O.serif,
                    fontStyle: "italic",
                    fontSize: 44,
                    fontWeight: 400,
                    lineHeight: 1,
                    background: aurora,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    marginBottom: 18,
                  }}
                >
                  {p.no}
                </div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    color: O.ink,
                    margin: 0,
                  }}
                >
                  {p.title}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: O.ink3,
                    marginTop: 8,
                    lineHeight: 1.55,
                  }}
                >
                  {p.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Stats ──────────────────────────────────────────────────── */

function StatsSection() {
  return (
    <section style={{ padding: "40px 0 80px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px" }}>
        <Reveal>
          <div
            style={{
              ...panel({ borderRadius: 22 }),
              padding: "28px 32px",
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 24,
            }}
            className="md:grid-cols-4 sm:grid-cols-2 grid-cols-1"
          >
            {[
              { v: 10_000_000, s: "+", label: "posts shared", foot: "+240k this week" },
              { v: 500_000, s: "K+", label: "active people", foot: "80 countries", raw: true },
              { v: 50_000, s: "K+", label: "rooms", foot: "across 42 topics", raw: true },
              { v: 99.98, s: "%", label: "uptime", foot: "last 12 months" },
            ].map((st, i) => (
              <div key={i}>
                <div
                  style={{
                    fontSize: 44,
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                    background: aurora,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <AnimatedNumber
                    target={st.v}
                    suffix={st.s}
                    format={
                      st.v >= 1_000_000
                        ? (v) => `${(v / 1_000_000).toFixed(1)}M`
                        : st.v >= 1000
                          ? (v) => `${Math.round(v / 1000)}`
                          : (v) => v.toFixed(2)
                    }
                  />
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: O.ink2,
                    marginTop: 6,
                    fontWeight: 500,
                  }}
                >
                  {st.label}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: O.ink4,
                    marginTop: 3,
                    fontFamily: O.mono,
                    letterSpacing: "0.06em",
                  }}
                >
                  {st.foot}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Testimonials ─────────────────────────────────────────────── */

const testimonials = [
  {
    quote:
      "The first social platform that feels built for creators, not advertisers. Clips alone changed how I reach my audience.",
    name: "Maya Tanaka",
    handle: "@maya.creates · photographer · 42k",
    hue: 18,
  },
  {
    quote:
      "I've tried every platform. Orbit is the only one where my community actually feels like a community — not an algorithm dumping strangers at me.",
    name: "Jordan Reyes",
    handle: "@darren.writes · newsletter · 18k",
    hue: 220,
  },
  {
    quote:
      "Audio posts and live streaming are incredible. I run a podcast and Orbit's tooling is better than dedicated podcast apps.",
    name: "Priya Bhatt",
    handle: "@priya.speaks · podcast host · 62k",
    hue: 340,
  },
];

function TestimonialsSection() {
  return (
    <section style={{ padding: "80px 0" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <Eyebrow accent>◇&nbsp;&nbsp;LOVED BY MAKERS</Eyebrow>
            <Display size={56} style={{ marginTop: 14 }}>
              Real <Acc>people</Acc>. Real <Acc>stories</Acc>.
            </Display>
            <p
              style={{
                fontSize: 14,
                color: O.ink3,
                marginTop: 14,
                maxWidth: 480,
                margin: "14px auto 0",
              }}
            >
              Not cherry-picked. These are creators who bet their audience on us.
            </p>
          </div>
        </Reveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
          className="md:grid-cols-3 sm:grid-cols-2 grid-cols-1"
        >
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08}>
              <div
                style={{
                  ...panel(),
                  padding: 22,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  height: "100%",
                }}
              >
                <p
                  style={{
                    fontSize: 13.5,
                    color: O.ink,
                    lineHeight: 1.55,
                    margin: 0,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {t.quote}
                </p>
                <div
                  style={{
                    height: 1,
                    background: O.hair,
                    marginTop: "auto",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, oklch(0.78 0.13 ${t.hue}), oklch(0.55 0.17 ${(t.hue + 40) % 360}))`,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: 700,
                      fontSize: 11,
                    }}
                  >
                    {t.name[0]}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: O.ink }}>
                      {t.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: O.ink3,
                        fontFamily: O.mono,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {t.handle}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ──────────────────────────────────────────────────────── */

function CtaSection() {
  return (
    <section style={{ padding: "100px 0 60px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 28px" }}>
        <Reveal>
          <div
            style={{
              ...panel({ borderRadius: 28 }),
              padding: "80px 40px",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: "-40%",
                background: `radial-gradient(ellipse at center, ${O.a2}22 0%, transparent 65%)`,
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative" }}>
              <Display size={64}>
                Ready to join
                <br />
                the <Acc>orbit</Acc>?
              </Display>
              <p
                style={{
                  fontSize: 14.5,
                  color: O.ink3,
                  marginTop: 20,
                  maxWidth: 420,
                  margin: "20px auto 0",
                  lineHeight: 1.55,
                }}
              >
                Your community is waiting. Start with one room, one post, one voice note.
              </p>
              <div
                style={{
                  marginTop: 32,
                  display: "flex",
                  gap: 10,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <Link href="/signup">
                  <PillBtn primary size="lg">
                    Get started — it&apos;s free
                    <ArrowRight style={{ width: 14, height: 14 }} />
                  </PillBtn>
                </Link>
                <Link href="/explore">
                  <PillBtn size="lg">Explore first</PillBtn>
                </Link>
              </div>
              <div
                style={{
                  marginTop: 22,
                  fontSize: 10.5,
                  color: O.ink4,
                  fontFamily: O.mono,
                  letterSpacing: "0.1em",
                }}
              >
                NO CREDIT CARD · 30-SEC SETUP · DELETE ANYTIME
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────── */

const footerCols = [
  { title: "Product", links: ["Feed", "Clips", "Moments", "Rooms", "Live", "Events", "Audio posts"] },
  { title: "Company", links: ["About", "Manifesto", "Careers", "Blog", "Brand"] },
  { title: "Legal", links: ["Terms", "Privacy", "Cookies", "Accessibility", "Community guidelines"] },
  { title: "Developers", links: ["API", "Docs", "Status", "Changelog"] },
];

function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${O.hair}`, padding: "48px 0 24px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2fr 1fr",
            gap: 64,
          }}
          className="md:grid-cols-[1fr_2fr_1fr] grid-cols-1"
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: aurora,
                  boxShadow: `0 4px 14px -2px ${O.a2}80`,
                }}
              />
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>
                Orbit
              </span>
            </div>
            <div
              style={{
                fontSize: 10.5,
                fontFamily: O.mono,
                letterSpacing: "0.14em",
                color: O.ink3,
                marginBottom: 16,
              }}
            >
              EVERYONE&apos;S RADIUS
            </div>
            <p style={{ fontSize: 12, color: O.ink3, lineHeight: 1.55, maxWidth: 220 }}>
              The internet, but smaller. Find your people — on your terms.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 24,
            }}
            className="md:grid-cols-4 grid-cols-2"
          >
            {footerCols.map((col) => (
              <div key={col.title}>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: O.mono,
                    letterSpacing: "0.14em",
                    color: O.ink3,
                    marginBottom: 12,
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {col.title}
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {col.links.map((l) => (
                    <li key={l} style={{ marginBottom: 8 }}>
                      <span
                        style={{
                          fontSize: 12,
                          color: O.ink2,
                          cursor: "pointer",
                        }}
                      >
                        {l}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div />
        </div>

        <div
          style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: `1px solid ${O.hair}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 10.5,
            fontFamily: O.mono,
            letterSpacing: "0.08em",
            color: O.ink4,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span>
            © 2026 ORBIT LABS · MADE WITH ♥ FOR THE UNDERCROWDED CORNERS
          </span>
          <span>ENGLISH · V4.2.1 · STATUS: GOOD</span>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ─────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div
      style={{
        ...orbitBg,
        minHeight: "100vh",
        color: O.ink,
        fontFamily: O.sans,
        overflow: "hidden",
      }}
    >
      <TopNav />
      <HeroSection />
      <BentoSection />
      <FeedInMotionSection />
      <BuiltDifferentSection />
      <StatsSection />
      <TestimonialsSection />
      <CtaSection />
      <Footer />
    </div>
  );
}
