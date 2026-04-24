"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { O, aurora } from "@/lib/design/orbit";
import { Display, Acc } from "@/components/orbit/primitives";

/**
 * Orbit empty-state template — ported from design-src/orbit-forms.jsx.
 * One template with aurora orbit rings + serif-italic accent headline
 * + optional dual CTA. Used across Rooms / Live / Events / Notifications.
 */
export function OrbitEmptyState({
  icon: Icon,
  accent = O.a2,
  headline,
  accentWord,
  sub,
  ctaLabel,
  ctaIcon,
  onCta,
  secondaryLabel,
  onSecondary,
}: {
  icon: LucideIcon;
  accent?: string;
  /** Plain text that precedes the serif-italic accent word(s). */
  headline: string;
  /** Italic-serif word(s) inside the headline. */
  accentWord: string;
  /** Plain text that follows the accent word (optional). */
  headlineTail?: string;
  sub: ReactNode;
  ctaLabel?: string;
  ctaIcon?: ReactNode;
  onCta?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
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
      <div style={{ textAlign: "center", maxWidth: 440 }}>
        <div
          style={{
            position: "relative",
            width: 140,
            height: 140,
            margin: "0 auto 28px",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: `1px solid ${O.hair2}`,
              animation: "orbitRing 8s linear infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 14,
              borderRadius: "50%",
              border: `1px dashed ${O.hair2}`,
              animation: "orbitRing 12s linear infinite reverse",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 34,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`,
              boxShadow: `inset 0 0 0 1px ${accent}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon style={{ width: 28, height: 28, color: accent }} strokeWidth={1.8} />
          </div>
          <style>{`@keyframes orbitRing{to{transform:rotate(360deg)}}`}</style>
        </div>

        <Display size={34} style={{ lineHeight: 1.08 }}>
          {headline} <Acc>{accentWord}</Acc>.
        </Display>
        <p
          style={{
            fontSize: 14,
            color: O.ink3,
            marginTop: 14,
            lineHeight: 1.55,
          }}
        >
          {sub}
        </p>

        {(ctaLabel || secondaryLabel) && (
          <div style={{ display: "inline-flex", gap: 10, marginTop: 22 }}>
            {secondaryLabel && (
              <button
                type="button"
                onClick={onSecondary}
                style={{
                  padding: "11px 18px",
                  borderRadius: 99,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${O.hair2}`,
                  color: O.ink,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {secondaryLabel}
              </button>
            )}
            {ctaLabel && (
              <button
                type="button"
                onClick={onCta}
                style={{
                  padding: "12px 22px",
                  borderRadius: 99,
                  background: aurora,
                  color: "#0c0a17",
                  border: "none",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: `0 8px 24px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.3)`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "inherit",
                }}
              >
                {ctaIcon}
                {ctaLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
