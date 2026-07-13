"use client";

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { O, aurora } from "@/lib/design/orbit";

/** Premium pill button: only button style used in the Glass system. */
export function PillBtn({
  children,
  primary = false,
  size = "md",
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  primary?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sz: CSSProperties =
    size === "sm"
      ? { padding: "7px 14px", fontSize: 12 }
      : size === "lg"
        ? { padding: "14px 28px", fontSize: 15 }
        : { padding: "10px 18px", fontSize: 13 };
  return (
    <button
      {...rest}
      style={{
        ...sz,
        borderRadius: 99,
        fontWeight: 600,
        letterSpacing: "-0.005em",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        ...(primary
          ? {
              border: "none",
              background: aurora,
              color: "white",
              boxShadow: `0 8px 24px -6px color-mix(in oklab, ${O.a1} 50%, transparent), inset 0 1px 0 rgba(255,255,255,0.25)`,
            }
          : {
              background: O.glass,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: `1px solid ${O.hair2}`,
              color: O.ink,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Small letterspaced monospace section label. */
export function Eyebrow({
  children,
  accent = false,
}: {
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        fontFamily: O.mono,
        fontSize: 10.5,
        letterSpacing: "0.18em",
        color: accent ? O.a3 : O.ink3,
        fontWeight: 500,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

/** Display heading: sans with tight tracking. Pair with <Acc> for italic emphasis. */
export function Display({
  children,
  size = 56,
  style,
}: {
  children: ReactNode;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <h1
      style={{
        fontFamily: O.sans,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: "-0.035em",
        lineHeight: 1,
        margin: 0,
        color: O.ink,
        ...style,
      }}
    >
      {children}
    </h1>
  );
}

/** Inline italic-serif accent inside <Display>. Aurora-gradient text by
 *  default; pass `color` to override with a solid brand/accent color. */
export function Acc({ children, color }: { children: ReactNode; color?: string }) {
  const fillStyle = color
    ? { color }
    : {
        background: aurora,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      };
  return (
    <em
      style={{
        fontFamily: O.serif,
        fontStyle: "italic",
        fontWeight: 400,
        paddingRight: "0.04em",
        ...fillStyle,
      }}
    >
      {children}
    </em>
  );
}
