/**
 * Bridge tokens for the refined-dark migration. Every legacy Orbit Glass
 * token now resolves to a CSS variable from globals.css, so unmigrated
 * inline-style pages render flat and theme-aware. Pages drop this module
 * entirely as they migrate to Tailwind classes; delete it when the last
 * consumer is gone.
 *
 * Do not concatenate hex alpha onto these values (`${O.a1}66`): a var()
 * reference plus hex digits silently invalidates the whole declaration.
 * Use `color-mix(in oklab, ${O.a1} 40%, transparent)` instead.
 */

import type { CSSProperties } from "react";

export const O = {
  bg: "var(--background)",
  bg2: "var(--surface)",
  bg3: "var(--surface-elevated)",
  // The aurora trio collapses to the single ember accent.
  a1: "var(--primary)",
  a2: "var(--primary)",
  a3: "var(--primary)",
  ink: "var(--foreground)",
  ink2: "var(--text-secondary)",
  ink3: "var(--muted-foreground)",
  ink4: "var(--text-faint)",
  // Former glass tones render as opaque surfaces.
  glass: "var(--surface)",
  glass2: "var(--surface-elevated)",
  hair: "var(--border)",
  hair2: "var(--border)",
  sans: "var(--font-geist-sans), -apple-system, system-ui, sans-serif",
  // Serif is retired; anything that asked for it gets the sans stack.
  serif: "var(--font-geist-sans), -apple-system, system-ui, sans-serif",
  mono: "var(--font-geist-mono), ui-monospace, monospace",
} as const;

export const orbitBg: CSSProperties = {
  background: "var(--background)",
};

// Former glass panel: now a flat card. Callers that override borderRadius
// or padding through `extra` keep working unchanged.
export const panel = (extra: CSSProperties = {}): CSSProperties => ({
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  ...extra,
});

// Former indigo-magenta-cyan gradient: primary actions are solid ember now.
export const aurora = "var(--primary)";
export const auroraSoft = "color-mix(in oklab, var(--primary) 10%, transparent)";
