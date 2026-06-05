"use client";

import type {
  CSSProperties,
  ChangeEvent,
  InputHTMLAttributes,
  KeyboardEvent,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { useState } from "react";
import { X } from "lucide-react";
import { O, aurora, auroraSoft } from "@/lib/design/orbit";

/**
 * Orbit form primitives, ported verbatim from design-src/orbit-forms.jsx.
 * Use these for every input across the app. Don't reinvent.
 */

/* ─── Field ─────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  children,
  style,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 18, ...style }}>
      {(label || hint) && (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          {label && (
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: O.ink,
                letterSpacing: "-0.005em",
              }}
            >
              {label}
            </label>
          )}
          {hint && (
            <span
              style={{
                fontSize: 11,
                color: O.ink3,
                fontFamily: O.mono,
                letterSpacing: "0.02em",
              }}
            >
              {hint}
            </span>
          )}
        </div>
      )}
      {children}
      {error && (
        <div
          style={{
            fontSize: 11.5,
            color: "#ff7a85",
            marginTop: 6,
            fontFamily: O.mono,
            letterSpacing: "0.02em",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

/* ─── Input ─────────────────────────────────────────────────────── */

type InputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "prefix" | "size"
> & {
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export function Input({ prefix, suffix, style, onFocus, onBlur, ...rest }: InputProps) {
  const [focus, setFocus] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${focus ? `${O.a2}66` : O.hair2}`,
        boxShadow: focus
          ? `0 0 0 3px ${O.a2}1a, inset 0 1px 0 rgba(255,255,255,0.04)`
          : "inset 0 1px 0 rgba(255,255,255,0.03)",
        transition: "all 0.15s",
      }}
    >
      {prefix && (
        <span
          style={{
            fontSize: 13.5,
            color: O.ink3,
            fontFamily: O.mono,
            fontWeight: 500,
          }}
        >
          {prefix}
        </span>
      )}
      <input
        {...rest}
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        style={{
          flex: 1,
          fontSize: 14,
          color: O.ink,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          background: "transparent",
          border: "none",
          outline: "none",
          fontFamily: "inherit",
          minWidth: 0,
          ...style,
        }}
      />
      {suffix && (
        <span
          style={{
            fontSize: 11.5,
            color: O.ink3,
            fontFamily: O.mono,
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

/* ─── TextArea ───────────────────────────────────────────────────── */

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  counter?: ReactNode;
};

export function TextArea({
  counter,
  rows = 3,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextAreaProps) {
  const [focus, setFocus] = useState(false);
  return (
    <div>
      <div
        style={{
          padding: "11px 14px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${focus ? `${O.a2}66` : O.hair2}`,
          boxShadow: focus ? `0 0 0 3px ${O.a2}1a` : "none",
          transition: "all 0.15s",
        }}
      >
        <textarea
          {...rest}
          rows={rows}
          onFocus={(e) => {
            setFocus(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            onBlur?.(e);
          }}
          style={{
            width: "100%",
            fontSize: 14,
            color: O.ink,
            lineHeight: 1.55,
            letterSpacing: "-0.005em",
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: "inherit",
            resize: "vertical",
            minHeight: rows * 20,
            ...style,
          }}
        />
      </div>
      {counter && (
        <div
          style={{
            fontSize: 10.5,
            color: O.ink3,
            fontFamily: O.mono,
            letterSpacing: "0.04em",
            marginTop: 6,
            textAlign: "right",
          }}
        >
          {counter}
        </div>
      )}
    </div>
  );
}

/* ─── Toggle ─────────────────────────────────────────────────────── */

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange?: (v: boolean) => void;
  label?: ReactNode;
}) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
      onClick={() => onChange?.(!on)}
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange?.(!on);
        }
      }}
    >
      <div
        style={{
          width: 36,
          height: 20,
          borderRadius: 99,
          padding: 2,
          background: on ? aurora : "rgba(255,255,255,0.08)",
          boxShadow: on
            ? `0 0 12px ${O.a2}55, inset 0 1px 0 rgba(255,255,255,0.15)`
            : "inset 0 1px 2px rgba(0,0,0,0.3)",
          transition: "all 0.2s",
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            transform: on ? "translateX(16px)" : "translateX(0)",
            transition: "transform 0.2s",
          }}
        />
      </div>
      {label && (
        <span style={{ fontSize: 13, color: O.ink2, fontWeight: 500 }}>
          {label}
        </span>
      )}
    </div>
  );
}

/* ─── RadioRow ───────────────────────────────────────────────────── */

export type RadioOption<T extends string = string> = {
  value: T;
  label: string;
  hint?: string;
  accent?: string;
};

export function RadioRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: RadioOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        gap: 8,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        const accent = o.accent || O.a2;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              background: active ? `${accent}18` : "rgba(255,255,255,0.025)",
              border: `1px solid ${active ? `${accent}66` : O.hair2}`,
              color: O.ink,
              cursor: "pointer",
              textAlign: "left",
              boxShadow: active ? `0 0 0 3px ${accent}18` : "none",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 2,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: `1.5px solid ${active ? accent : O.hair2}`,
                  background: active ? accent : "transparent",
                  boxShadow: active ? `inset 0 0 0 2.5px #0a0b1f` : "none",
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{o.label}</span>
            </div>
            {o.hint && (
              <div
                style={{
                  fontSize: 11,
                  color: O.ink3,
                  fontFamily: O.mono,
                  letterSpacing: "0.02em",
                }}
              >
                {o.hint}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── FormSection ────────────────────────────────────────────────── */

export function FormSection({
  title,
  hint,
  children,
}: {
  title: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ marginTop: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            margin: 0,
            letterSpacing: "-0.01em",
            color: O.ink,
          }}
        >
          {title}
        </h3>
        {hint && (
          <span
            style={{
              fontSize: 11,
              color: O.ink3,
              fontFamily: O.mono,
              letterSpacing: "0.04em",
            }}
          >
            · {hint}
          </span>
        )}
      </div>
      <div
        style={{
          padding: 20,
          borderRadius: 18,
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${O.hair2}`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─── ModalShell ─────────────────────────────────────────────────── */

export function ModalShell({
  children,
  title,
  subtitle,
  icon,
  accent = O.a2,
  width = 520,
  danger,
  primaryLabel = "Confirm",
  onPrimary,
  secondaryLabel = "Cancel",
  onSecondary,
  canSubmit = true,
  loading = false,
  onClose,
}: {
  children: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  accent?: string;
  width?: number;
  danger?: boolean;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  canSubmit?: boolean;
  loading?: boolean;
  onClose?: () => void;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: width,
        position: "relative",
        background: "rgba(18,16,32,0.82)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        border: `1px solid ${O.hair2}`,
        borderRadius: 22,
        boxShadow: `0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 100px ${accent}22`,
        overflow: "hidden",
        color: O.ink,
        fontFamily: O.sans,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 22px 18px",
          borderBottom: `1px solid ${O.hair}`,
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          background: "linear-gradient(180deg, rgba(255,255,255,0.03), transparent)",
        }}
      >
        {icon && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: `${accent}1f`,
              border: `1px solid ${accent}55`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: accent,
              flexShrink: 0,
              boxShadow: `0 0 20px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
          >
            {icon}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 12.5,
                color: O.ink3,
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${O.hair}`,
              color: O.ink2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X style={{ width: 13, height: 13 }} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "20px 22px", maxHeight: 520, overflow: "auto" }}>
        {children}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "14px 22px 18px",
          borderTop: `1px solid ${O.hair}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: "flex-end",
          background: "linear-gradient(0deg, rgba(255,255,255,0.02), transparent)",
        }}
      >
        <button
          type="button"
          onClick={onSecondary ?? onClose}
          style={{
            padding: "9px 16px",
            borderRadius: 99,
            background: "transparent",
            border: `1px solid ${O.hair2}`,
            color: O.ink2,
            fontSize: 12.5,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {secondaryLabel}
        </button>
        <button
          type="button"
          onClick={onPrimary}
          disabled={!canSubmit || loading}
          style={{
            padding: "10px 20px",
            borderRadius: 99,
            background: canSubmit
              ? danger
                ? "linear-gradient(135deg, #ff6a7a, #c8435a)"
                : aurora
              : "rgba(255,255,255,0.06)",
            color: canSubmit ? "#fff" : O.ink3,
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            cursor: canSubmit && !loading ? "pointer" : "not-allowed",
            boxShadow: canSubmit
              ? `0 6px 20px ${danger ? "#ff6a7a55" : `${accent}55`}, inset 0 1px 0 rgba(255,255,255,0.3)`
              : "none",
            letterSpacing: "-0.005em",
            opacity: loading ? 0.7 : 1,
            fontFamily: "inherit",
          }}
        >
          {loading ? "…" : primaryLabel}
        </button>
      </div>
    </div>
  );
}

/* Re-export auroraSoft for modal internals */
export { auroraSoft };
