/**
 * Refined-dark token palette, ported from the web app's globals.css oklch
 * values as hex. Dark-only is a decision, not an oversight: app.json pins
 * userInterfaceStyle to dark so the OS never hands the app a light
 * appearance, the settings screen says so out loud, and these stay plain
 * constants rather than a useColorScheme lookup until a light palette is
 * actually designed.
 */
export const colors = {
  background: "#0b0b0d",
  surface: "#131316",
  surfaceElevated: "#1b1b1f",
  border: "#26262b",
  foreground: "#f0eff2",
  textSecondary: "#b3b1b8",
  mutedForeground: "#8a888f",
  textFaint: "#5f5d66",
  primary: "#ac77fa",
  primaryForeground: "#17111f",
  destructive: "#e5484d",
  success: "#30a46c",
  warning: "#ffb224",
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

export const spacing = (n: number) => n * 4;
