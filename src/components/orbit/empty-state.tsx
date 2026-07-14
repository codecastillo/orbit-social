"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Display, Acc } from "@/components/orbit/primitives";

/**
 * Empty-state template: flat icon tile, accent headline word, optional dual
 * CTA. Used across Rooms / Live / Events / Notifications.
 */
export function OrbitEmptyState({
  icon: Icon,
  accent = "var(--primary)",
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
  /** Plain text that precedes the accent word(s). */
  headline: string;
  /** Accent-colored word(s) inside the headline. */
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
        color: "var(--foreground)",
        fontFamily: "var(--font-geist-sans), -apple-system, system-ui, sans-serif",
        padding: 60,
        boxSizing: "border-box",
        minHeight: 420,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 440 }}>
        <div
          style={{
            width: 72,
            height: 72,
            margin: "0 auto 24px",
            borderRadius: 16,
            background: `color-mix(in oklab, ${accent} 10%, transparent)`,
            border: `1px solid color-mix(in oklab, ${accent} 25%, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon style={{ width: 28, height: 28, color: accent }} strokeWidth={1.8} />
        </div>

        <Display size={34} style={{ lineHeight: 1.08 }}>
          {headline} <Acc>{accentWord}</Acc>.
        </Display>
        <p
          style={{
            fontSize: 14,
            color: "var(--muted-foreground)",
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
                  borderRadius: 8,
                  background: "var(--surface)",
                  border: `1px solid var(--border)`,
                  color: "var(--foreground)",
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
                  borderRadius: 8,
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                  border: "none",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
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
