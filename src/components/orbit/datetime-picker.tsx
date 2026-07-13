"use client";

import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { O, aurora, auroraSoft } from "@/lib/design/orbit";

// Lightweight datetime picker matching the Orbit design. Operates on the
// same `yyyy-MM-ddTHH:mm` string format used by <input type="datetime-local">
// so it's a drop-in replacement for the native control.

interface DateTimePickerProps {
  value: string; // yyyy-MM-ddTHH:mm or ""
  onChange: (next: string) => void;
  placeholder?: string;
  minuteStep?: number;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function parseValue(value: string): { year: number; month: number; day: number; hours: number; minutes: number } | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]) - 1,
    day: Number(m[3]),
    hours: Number(m[4]),
    minutes: Number(m[5]),
  };
}

function buildValue(year: number, month: number, day: number, hours: number, minutes: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`;
}

function formatDisplay(value: string): string {
  const parsed = parseValue(value);
  if (!parsed) return "";
  const date = new Date(parsed.year, parsed.month, parsed.day, parsed.hours, parsed.minutes);
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function DateTimePicker({ value, onChange, placeholder = "Pick a date", minuteStep = 5 }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);

  const parsed = parseValue(value);
  const today = new Date();
  const initialYear = parsed?.year ?? today.getFullYear();
  const initialMonth = parsed?.month ?? today.getMonth();

  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  // Re-anchor the visible month whenever the popover opens against the
  // currently-selected value (or today if nothing is set yet).
  const handleOpenChange = (next: boolean) => {
    if (next) {
      const anchor = parsed ?? {
        year: today.getFullYear(),
        month: today.getMonth(),
        day: today.getDate(),
        hours: today.getHours(),
        minutes: today.getMinutes(),
      };
      setViewYear(anchor.year);
      setViewMonth(anchor.month);
    }
    setOpen(next);
  };

  const days = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: { day: number | null }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
    return cells;
  }, [viewYear, viewMonth]);

  const selectedDay =
    parsed && parsed.year === viewYear && parsed.month === viewMonth ? parsed.day : null;

  const stepMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const handlePickDay = (day: number) => {
    const t = parsed ?? { hours: 19, minutes: 0 };
    onChange(buildValue(viewYear, viewMonth, day, t.hours, t.minutes));
  };

  const handleTimeChange = (hours: number, minutes: number) => {
    if (!parsed) {
      const todayPart = {
        year: today.getFullYear(),
        month: today.getMonth(),
        day: today.getDate(),
      };
      onChange(buildValue(todayPart.year, todayPart.month, todayPart.day, hours, minutes));
      return;
    }
    onChange(buildValue(parsed.year, parsed.month, parsed.day, hours, minutes));
  };

  const display = formatDisplay(value);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "11px 14px",
          borderRadius: 12,
          background: "var(--surface)",
          border: `1px solid ${O.hair2}`,
          color: display ? O.ink : O.ink3,
          fontSize: 13.5,
          fontFamily: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <CalendarIcon style={{ width: 15, height: 15, color: O.ink3 }} strokeWidth={1.7} />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {display || placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={6}
        style={{
          width: 304,
          padding: 0,
          background: "var(--surface-elevated)",
          border: `1px solid ${O.hair2}`,
          borderRadius: 16,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.35)",
          color: O.ink,
          fontFamily: "inherit",
        }}
      >
        {/* Month nav */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px 6px",
          }}
        >
          <button
            type="button"
            onClick={() => stepMonth(-1)}
            style={navBtnStyle}
            aria-label="Previous month"
          >
            <ChevronLeft style={{ width: 14, height: 14 }} strokeWidth={1.8} />
          </button>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {MONTHS[viewMonth]} {viewYear}
          </div>
          <button
            type="button"
            onClick={() => stepMonth(1)}
            style={navBtnStyle}
            aria-label="Next month"
          >
            <ChevronRight style={{ width: 14, height: 14 }} strokeWidth={1.8} />
          </button>
        </div>

        {/* Weekday header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 2,
            padding: "0 14px",
            marginTop: 4,
          }}
        >
          {WEEKDAYS.map((d, i) => (
            <div
              key={i}
              style={{
                fontSize: 10,
                fontFamily: O.mono,
                letterSpacing: "0.1em",
                color: O.ink4,
                textAlign: "center",
                padding: "4px 0",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 2,
            padding: "2px 14px 12px",
          }}
        >
          {days.map((cell, idx) => {
            if (cell.day === null) return <div key={idx} />;
            const isSelected = selectedDay === cell.day;
            const isToday =
              today.getFullYear() === viewYear &&
              today.getMonth() === viewMonth &&
              today.getDate() === cell.day;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handlePickDay(cell.day!)}
                style={{
                  height: 34,
                  borderRadius: 10,
                  border: isToday && !isSelected ? `1px solid ${O.hair2}` : "1px solid transparent",
                  background: isSelected ? aurora : "transparent",
                  color: isSelected ? "var(--primary-foreground)" : O.ink,
                  fontSize: 12.5,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "background 120ms",
                                  }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = auroraSoft;
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        {/* Time row: 12-hour with AM/PM segmented toggle. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderTop: `1px solid ${O.hair}`,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontFamily: O.mono,
              letterSpacing: "0.08em",
              color: O.ink3,
              textTransform: "uppercase",
            }}
          >
            Time
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <TimeUnit
              value={to12Hour(parsed?.hours ?? 19)}
              min={1}
              max={12}
              onChange={(h12) => {
                const h24 = from12Hour(h12, isPm(parsed?.hours ?? 19));
                handleTimeChange(h24, parsed?.minutes ?? 0);
              }}
            />
            <span style={{ color: O.ink3, fontWeight: 600 }}>:</span>
            <TimeUnit
              value={parsed?.minutes ?? 0}
              min={0}
              max={59}
              step={minuteStep}
              onChange={(m) => handleTimeChange(parsed?.hours ?? 19, m)}
            />
            <AmPmToggle
              isPm={isPm(parsed?.hours ?? 19)}
              onChange={(pm) => {
                const h12 = to12Hour(parsed?.hours ?? 19);
                handleTimeChange(from12Hour(h12, pm), parsed?.minutes ?? 0);
              }}
            />
          </div>
        </div>

        {/* Done: closes the popover and commits whatever the user picked. */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "10px 14px 14px",
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              background: aurora,
              color: "var(--primary-foreground)",
              border: "none",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Done
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function to12Hour(h24: number): number {
  const mod = h24 % 12;
  return mod === 0 ? 12 : mod;
}

function from12Hour(h12: number, pm: boolean): number {
  if (h12 === 12) return pm ? 12 : 0;
  return pm ? h12 + 12 : h12;
}

function isPm(h24: number): boolean {
  return h24 >= 12;
}

function AmPmToggle({ isPm, onChange }: { isPm: boolean; onChange: (pm: boolean) => void }) {
  return (
    <div
      style={{
        display: "flex",
        background: "var(--surface)",
        border: `1px solid ${O.hair2}`,
        borderRadius: 8,
        padding: 2,
        marginLeft: 4,
      }}
    >
      {(["AM", "PM"] as const).map((label) => {
        const active = (label === "PM") === isPm;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(label === "PM")}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              background: active ? aurora : "transparent",
              color: active ? "var(--primary-foreground)" : O.ink3,
              border: "none",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: O.mono,
              letterSpacing: "0.08em",
              cursor: "pointer",
                          }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: "grid",
  placeItems: "center",
  borderRadius: 8,
  background: "var(--surface)",
  border: `1px solid ${O.hair2}`,
  color: O.ink2,
  cursor: "pointer",
};

function TimeUnit({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <input
      type="number"
      value={pad(value)}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const raw = Number(e.target.value);
        if (Number.isFinite(raw)) onChange(clamp(raw));
      }}
      style={{
        width: 48,
        padding: "6px 8px",
        borderRadius: 8,
        background: "var(--surface)",
        border: `1px solid ${O.hair2}`,
        color: O.ink,
        fontSize: 13,
        fontVariantNumeric: "tabular-nums",
        textAlign: "center",
        fontFamily: "inherit",
        outline: "none",
      }}
    />
  );
}
