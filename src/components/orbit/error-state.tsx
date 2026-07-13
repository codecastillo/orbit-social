"use client";

import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { O, aurora } from "@/lib/design/orbit";
import { Display, Acc } from "@/components/orbit/primitives";

/**
 * Error state for surfaces where remote data couldn't load: destructive
 * icon tile, accent headline word, try-again button.
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
            width: 72,
            height: 72,
            borderRadius: 16,
            margin: "0 auto 20px",
            background: "color-mix(in oklab, var(--destructive) 10%, transparent)",
            border: "1px solid color-mix(in oklab, var(--destructive) 30%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AlertCircle
            style={{ width: 32, height: 32, color: "var(--destructive)" }}
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
              borderRadius: 8,
              background: aurora,
              color: "var(--primary-foreground)",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
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
