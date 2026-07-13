"use client";

import { forwardRef, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Centered card layout shared by every auth page. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10 text-foreground sm:p-12">
      <div className="landing-fade-in w-full max-w-[460px]">
        <div className="mb-5 flex justify-center">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="relative h-8 w-8 rounded-lg bg-primary">
              <div className="absolute inset-1 rounded-md border-[1.5px] border-primary-foreground/50" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              Orbit
            </span>
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-7 sm:p-10">
          {children}
        </div>
        <p className="mt-4 text-center font-mono text-[11px] tracking-[0.08em] text-text-faint">
          SECURE · END-TO-END
        </p>
      </div>
    </main>
  );
}

/** Eyebrow + display heading + optional subcopy, centered. */
export function AuthHeading({
  eyebrow,
  title,
  accent,
  sub,
}: {
  eyebrow: string;
  /** Plain text before the accent word. */
  title: string;
  /** Accent-colored word(s), rendered ember with a trailing period. */
  accent: string;
  sub?: ReactNode;
}) {
  return (
    <div className="text-center">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </p>
      <h1 className="mt-2.5 text-[32px] font-bold leading-tight tracking-[-0.03em] text-foreground">
        {title} <span className="text-primary">{accent}</span>.
      </h1>
      {sub && (
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-secondary">
          {sub}
        </p>
      )}
    </div>
  );
}

export function AuthField({
  label,
  hint,
  error,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      {(label || hint) && (
        <div className="mb-2 flex items-baseline justify-between">
          {label && (
            <label className="text-xs font-semibold text-foreground">
              {label}
            </label>
          )}
          {hint && (
            <span className="text-[11px] text-muted-foreground">{hint}</span>
          )}
        </div>
      )}
      {children}
      {error && (
        <p className="mt-1.5 font-mono text-[11.5px] tracking-wide text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

type AuthInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "prefix" | "size"
> & {
  prefix?: ReactNode;
  suffix?: ReactNode;
};

/** Bordered input row with optional prefix/suffix slots and an ember focus
 *  ring on the whole row (so suffix buttons sit inside the field). */
export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  function AuthInput({ prefix, suffix, className, onFocus, onBlur, ...rest }, ref) {
    const [focus, setFocus] = useState(false);
    return (
      <div
        className={cn(
          "flex min-w-0 items-center gap-2.5 rounded-lg border bg-background px-3.5 py-[11px] transition-shadow",
          focus
            ? "border-primary/40 ring-[3px] ring-primary/10"
            : "border-input"
        )}
      >
        {prefix && (
          <span className="font-mono text-[13.5px] font-medium text-muted-foreground">
            {prefix}
          </span>
        )}
        <input
          {...rest}
          ref={ref}
          onFocus={(e) => {
            setFocus(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            onBlur?.(e);
          }}
          className={cn(
            "min-w-0 flex-1 border-none bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground",
            className
          )}
        />
        {suffix && (
          <span className="flex items-center text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);
