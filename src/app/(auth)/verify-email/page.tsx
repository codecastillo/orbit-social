"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Loader2, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { O, orbitBg, panel, aurora } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "Failed to resend. Try again later.");
      } else {
        setResent(true);
        toast.success("Verification email sent");
        setTimeout(() => setResent(false), 30000);
      }
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setResending(false);
    }
  };

  const steps = [
    "Open your email inbox.",
    "Tap the link from Orbit.",
    "You'll land back here, signed in.",
  ];

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

        <div style={{ ...panel({ borderRadius: 24 }), padding: 40, textAlign: "center" }}>
          <div
            style={{
              width: 72,
              height: 72,
              margin: "0 auto 16px",
              borderRadius: "50%",
              background: `${O.a3}15`,
              border: `1px solid ${O.a3}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: O.a3,
            }}
          >
            <Mail style={{ width: 30, height: 30 }} strokeWidth={1.8} />
          </div>

          <Eyebrow accent>◇&nbsp;&nbsp;VERIFY · EMAIL</Eyebrow>
          <Display size={32} style={{ marginTop: 10 }}>
            Check your <Acc>inbox</Acc>.
          </Display>
          <p
            style={{
              fontSize: 13.5,
              color: O.ink3,
              marginTop: 10,
              lineHeight: 1.55,
            }}
          >
            We sent a verification link to
          </p>
          {email && (
            <div
              style={{
                marginTop: 8,
                padding: "7px 14px",
                borderRadius: 99,
                background: O.glass,
                border: `1px solid ${O.hair2}`,
                fontFamily: O.mono,
                fontSize: 12,
                color: O.ink,
                display: "inline-flex",
              }}
            >
              {email}
            </div>
          )}

          <div
            style={{
              ...panel({ borderRadius: 18 }),
              padding: 18,
              marginTop: 24,
              textAlign: "left",
            }}
          >
            {steps.map((text, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "10px 0",
                  borderTop: i ? `1px solid ${O.hair}` : "none",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: O.glass,
                    border: `1px solid ${O.a2}44`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: O.mono,
                    fontSize: 11,
                    fontWeight: 700,
                    color: O.a2,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <span style={{ fontSize: 13.5, color: O.ink2 }}>{text}</span>
              </div>
            ))}
          </div>

          <PillBtn
            size="lg"
            onClick={handleResend}
            disabled={resending || resent}
            style={{
              marginTop: 20,
              width: "100%",
              justifyContent: "center",
              ...(resent
                ? {
                    border: "1px solid rgba(125,255,163,0.4)",
                    color: "#7dffa3",
                  }
                : {}),
            }}
          >
            {resending ? (
              <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
            ) : resent ? (
              <CheckCircle style={{ width: 14, height: 14 }} />
            ) : (
              <Mail style={{ width: 14, height: 14 }} />
            )}
            {resent ? "Sent — check again in 30s" : "Resend verification"}
          </PillBtn>

          <p style={{ marginTop: 20, fontSize: 13, color: O.ink3 }}>
            Wrong email?{" "}
            <Link
              href="/signup"
              style={{ color: O.a3, textDecoration: "none", fontWeight: 600 }}
            >
              Start over →
            </Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
