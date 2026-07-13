"use client";

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { O } from "@/lib/design/orbit";

/** Legacy button shim: flat ember primary / bordered surface secondary.
 *  Call sites migrate to ui/button batch by batch; keep the props stable. */
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
      ? { padding: "6px 12px", fontSize: 12 }
      : size === "lg"
        ? { padding: "12px 24px", fontSize: 15 }
        : { padding: "9px 16px", fontSize: 13 };
  return (
    <button
      {...rest}
      style={{
        ...sz,
        borderRadius: 8,
        fontWeight: 600,
        letterSpacing: "-0.005em",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        ...(primary
          ? {
              border: "none",
              background: "var(--primary)",
              color: "var(--primary-foreground)",
            }
          : {
              background: O.glass,
              border: `1px solid ${O.hair2}`,
              color: O.ink,
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

/** Display heading: sans with tight tracking. Pair with <Acc> for emphasis. */
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

/** Inline accent inside <Display>: solid ember, weight inherited from the
 *  heading. The italic serif treatment retired with the Glass system. */
export function Acc({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <em
      style={{
        fontStyle: "normal",
        color: color || "var(--primary)",
        paddingRight: "0.04em",
      }}
    >
      {children}
    </em>
  );
}
