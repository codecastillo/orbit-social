// Timezone helpers shared by the event create + edit flows.
//
// `zonedLocalToUTCISO` takes a "yyyy-MM-ddTHH:mm" wall-clock string written
// AS IF the user is in `tz`, and returns the equivalent UTC ISO string.
// without pulling in date-fns-tz / luxon. The trick: format an arbitrary
// UTC instant in the target zone, diff against the wall reading, apply.

export function zonedLocalToUTCISO(local: string, tz: string): string {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return new Date(local).toISOString();

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);

  // Treat the wall reading as if it were UTC, then ask the browser what
  // wall time corresponds to that UTC instant in the target zone. The
  // difference is the zone offset for that date.
  const asUTC = Date.UTC(y, mo - 1, d, h, mi);
  const inTzString = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(asUTC));

  const get = (type: string) => Number(inTzString.find((p) => p.type === type)?.value ?? 0);
  const tzMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24, // Intl returns "24" for midnight on some locales
    get("minute"),
    get("second"),
  );
  const offset = asUTC - tzMs;

  return new Date(asUTC + offset).toISOString();
}

// Browser-detected IANA timezone (e.g. "America/Denver").
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// Curated short list, covers the common cases without overwhelming a
// dropdown. The user's own zone is always offered first by the picker.
export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/Los_Angeles", label: "Los Angeles · PT" },
  { value: "America/Denver", label: "Denver · MT" },
  { value: "America/Chicago", label: "Chicago · CT" },
  { value: "America/New_York", label: "New York · ET" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Africa/Lagos", label: "Lagos" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Kolkata", label: "Mumbai · Kolkata" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Pacific/Auckland", label: "Auckland" },
  { value: "UTC", label: "UTC" },
];
