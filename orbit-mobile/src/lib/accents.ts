/**
 * Curated profile accent palette, mirrored from the web app
 * (src/lib/design/accents.ts) so both clients resolve a stored theme_color
 * identically; null means the default violet brand accent. Legacy aurora-era
 * values map to their nearest curated equivalent at render time, so no data
 * migration is needed.
 */

export const PROFILE_ACCENTS: { value: string | null; label: string }[] = [
  { value: null, label: "Default" },
  { value: "#e5484d", label: "Red" },
  { value: "#ffb224", label: "Amber" },
  { value: "#30a46c", label: "Green" },
  { value: "#0091ff", label: "Blue" },
  // Orange replaced Violet when the brand accent went purple; a violet
  // personalization option would just disappear into the brand color.
  { value: "#f76b15", label: "Orange" },
  { value: "#d6409f", label: "Pink" },
];

const LEGACY_ACCENT_MAP: Record<string, string | null> = {
  "#ffffff": null,
  "#ff6a7a": "#e5484d",
  "#ff9a3d": "#ffb224",
  "#ffd76a": "#ffb224",
  "#7dffa3": "#30a46c",
  "#5fd4ff": "#0091ff",
  // Aurora indigo and the retired curated violet both read as the brand
  // accent now.
  "#8b73ff": null,
  "#8e4ec6": null,
  "#ff5fae": "#d6409f",
  "#ff8fd1": "#d6409f",
};

/** Resolve a stored theme_color to a curated accent (null = default). */
export function normalizeAccent(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored in LEGACY_ACCENT_MAP) return LEGACY_ACCENT_MAP[stored];
  return PROFILE_ACCENTS.some((a) => a.value === stored) ? stored : null;
}
