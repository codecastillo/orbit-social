"use client";

import { O } from "@/lib/design/orbit";

type Variant = "pill" | "pill-dark" | "corner" | "dot";

export function LiveBadge({
  variant = "pill",
  pulse = true,
  label = "LIVE",
  children,
}: {
  variant?: Variant;
  pulse?: boolean;
  label?: string;
  children?: React.ReactNode;
}) {
  if (variant === "dot") {
    return (
      <span
        style={{
          background: O.a2,
          color: "white",
          fontSize: 8,
          fontWeight: 800,
          padding: "2px 5px",
          borderRadius: 4,
          letterSpacing: "0.1em",
          boxShadow: `0 0 10px color-mix(in oklab, ${O.a2} 50%, transparent)`,
        }}
      >
        {label}
      </span>
    );
  }

  if (variant === "corner") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          background: O.a2,
          color: "white",
          fontSize: 9,
          fontWeight: 800,
          padding: "3px 8px",
          borderRadius: 4,
          letterSpacing: "0.12em",
          boxShadow: `0 0 14px color-mix(in oklab, ${O.a2} 40%, transparent)`,
        }}
      >
        {pulse && <Dot />}
        {label}
      </span>
    );
  }

  const dark = variant === "pill-dark";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 99,
        background: dark ? "rgba(0,0,0,0.4)" : O.a2,
        backdropFilter: dark ? "blur(20px)" : undefined,
        WebkitBackdropFilter: dark ? "blur(20px)" : undefined,
        color: "white",
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: "0.12em",
        fontFamily: dark ? O.mono : undefined,
        boxShadow: dark ? "none" : `0 0 18px color-mix(in oklab, ${O.a2} 50%, transparent)`,
      }}
    >
      {pulse && <Dot />}
      {children ?? label}
    </span>
  );
}

function Dot() {
  return (
    <>
      <style>{`@keyframes orbit-live-pulse {0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "white",
          animation: "orbit-live-pulse 1.4s infinite",
        }}
      />
    </>
  );
}
