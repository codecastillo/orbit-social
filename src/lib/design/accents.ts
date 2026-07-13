/**
 * Curated profile accent palette. Users personalize their avatar ring and
 * profile name tint with one of these flat, theme-safe colors; null means
 * the default ember brand accent. Legacy aurora-era values stored in
 * profiles.theme_color map to their nearest curated equivalent at render
 * time, so no data migration is needed.
 */

export const PROFILE_ACCENTS: { value: string | null; label: string }[] = [
  { value: null, label: "Default" },
  { value: "#e5484d", label: "Red" },
  { value: "#ffb224", label: "Amber" },
  { value: "#30a46c", label: "Green" },
  { value: "#0091ff", label: "Blue" },
  { value: "#8e4ec6", label: "Violet" },
  { value: "#d6409f", label: "Pink" },
];

const LEGACY_ACCENT_MAP: Record<string, string | null> = {
  "#ffffff": null,
  "#ff6a7a": "#e5484d",
  "#ff9a3d": "#ffb224",
  "#ffd76a": "#ffb224",
  "#7dffa3": "#30a46c",
  "#5fd4ff": "#0091ff",
  "#8b73ff": "#8e4ec6",
  "#ff5fae": "#d6409f",
  "#ff8fd1": "#d6409f",
};

/** Resolve a stored theme_color to a curated accent (null = default ember). */
export function normalizeAccent(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored in LEGACY_ACCENT_MAP) return LEGACY_ACCENT_MAP[stored];
  return PROFILE_ACCENTS.some((a) => a.value === stored) ? stored : null;
}
