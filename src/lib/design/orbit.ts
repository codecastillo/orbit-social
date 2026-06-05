/**
 * Orbit Glass design tokens, ported verbatim from the canonical design-src/orbit-system.jsx.
 * Single source of truth for the Glass direction. Consume via the `O` object for inline styles,
 * or the `orbitBg`, `panel`, `aurora`, `auroraSoft` helpers.
 */

import type { CSSProperties } from "react";

export const O = {
  // Cosmic deep space gradient: three light sources, deeper blacks
  bg: "#070818",
  bg2: "#0c0d22",
  bg3: "#15102b",
  // Brand: aurora, indigo to magenta to cyan, more saturated
  a1: "#8b73ff", // indigo
  a2: "#ff5fae", // magenta rose
  a3: "#5fd4ff", // cyan
  // Inks
  ink: "#ffffff",
  ink2: "rgba(255,255,255,0.78)",
  ink3: "rgba(255,255,255,0.5)",
  ink4: "rgba(255,255,255,0.3)",
  // Glass tones
  glass: "rgba(255,255,255,0.05)",
  glass2: "rgba(255,255,255,0.08)",
  hair: "rgba(255,255,255,0.09)",
  hair2: "rgba(255,255,255,0.14)",
  // Type
  sans: '"Geist", -apple-system, "Inter", system-ui, sans-serif',
  serif: '"Instrument Serif", "Fraunces", Georgia, serif',
  mono: '"Geist Mono", ui-monospace, monospace',
} as const;

// Layered atmospheric background: three soft light sources
export const orbitBg: CSSProperties = {
  background:
    `radial-gradient(ellipse 70% 60% at 12% 8%, ${O.a1}40 0%, transparent 55%),` +
    `radial-gradient(ellipse 60% 50% at 92% 95%, ${O.a2}32 0%, transparent 55%),` +
    `radial-gradient(ellipse 55% 50% at 90% 12%, ${O.a3}1f 0%, transparent 55%),` +
    `linear-gradient(160deg, ${O.bg} 0%, ${O.bg2} 50%, ${O.bg3} 100%)`,
};

// Premium glass panel: backdrop blur + saturate + inner highlight + outer ring
export const panel = (extra: CSSProperties = {}): CSSProperties => ({
  background: O.glass,
  backdropFilter: "blur(40px) saturate(180%)",
  WebkitBackdropFilter: "blur(40px) saturate(180%)",
  border: `1px solid ${O.hair}`,
  borderRadius: 24,
  boxShadow:
    "inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.02), 0 24px 64px -24px rgba(0,0,0,0.4)",
  ...extra,
});

// Aurora gradient: primary actions & accent fills
export const aurora = `linear-gradient(135deg, ${O.a1} 0%, ${O.a2} 55%, ${O.a3} 100%)`;
export const auroraSoft = `linear-gradient(135deg, ${O.a1}25 0%, ${O.a2}1f 55%, ${O.a3}25 100%)`;
