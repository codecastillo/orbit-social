"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Empty-state template: quiet icon tile, modest title, muted body, optional
 * dual CTA, vertically centered in the viewport. Deliberately NOT the page
 * header's display typography; when both used it, every empty page read like
 * it announced the same thing twice.
 */
export function OrbitEmptyState({
  icon: Icon,
  accent = "var(--primary)",
  headline,
  accentWord,
  headlineTail,
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
  /** Formerly accent-colored; now rendered as plain text in the title. */
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
  const title = [headline, accentWord, headlineTail].filter(Boolean).join(" ");
  return (
    <div className="flex min-h-[55vh] items-center justify-center px-6 text-foreground">
      <div className="flex max-w-[400px] flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-surface">
          <Icon className="h-6 w-6" strokeWidth={1.8} style={{ color: accent }} />
        </div>

        <h2 className="mt-5 text-lg font-semibold tracking-[-0.01em]">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{sub}</p>

        {(ctaLabel || secondaryLabel) && (
          <div className="mt-5 inline-flex gap-2.5">
            {secondaryLabel && (
              <Button variant="outline" onClick={onSecondary}>
                {secondaryLabel}
              </Button>
            )}
            {ctaLabel && (
              <Button onClick={onCta}>
                {ctaIcon}
                {ctaLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
