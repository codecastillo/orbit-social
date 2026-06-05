"use client";

import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { O, aurora } from "@/lib/design/orbit";
import { Display, Acc } from "@/components/orbit/primitives";

/**
 * Orbit error state, ported from design-src/orbit-forms.jsx ErrorMessagesState.
 * Red-glow ring + serif italic accent + try-again pill. For surfaces where
 * remote data couldn't load.
 */
export function OrbitErrorState({
  headline,
  accentWord,
  sub,
  errorCode,
  ctaLabel = "Try again",
  onRetry,
}: {
  headline: string;
  accentWord: string;
  sub?: ReactNode;
  errorCode?: string;
  ctaLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: O.ink,
        fontFamily: O.sans,
        padding: 60,
        boxSizing: "border-box",
        minHeight: 420,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            margin: "0 auto 20px",
            background: "rgba(255,106,122,0.1)",
            border: "1px solid rgba(255,106,122,0.35)",
            boxShadow: "0 0 30px rgba(255,106,122,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AlertCircle
            style={{ width: 32, height: 32, color: "#ff6a7a" }}
            strokeWidth={1.6}
          />
        </div>
        <Display size={30}>
          {headline} <Acc>{accentWord}</Acc>.
        </Display>
        {sub && (
          <p
            style={{
              fontSize: 13.5,
              color: O.ink3,
              marginTop: 14,
              lineHeight: 1.55,
            }}
          >
            {sub}
          </p>
        )}
        {errorCode && (
          <div
            style={{
              fontSize: 10.5,
              color: O.ink3,
              marginTop: 12,
              fontFamily: O.mono,
              letterSpacing: "0.08em",
            }}
          >
            {errorCode}
          </div>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              marginTop: 22,
              padding: "11px 22px",
              borderRadius: 99,
              background: aurora,
              color: "#0c0a17",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: `0 8px 24px ${O.a2}55, inset 0 1px 0 rgba(255,255,255,0.3)`,
              fontFamily: "inherit",
            }}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
