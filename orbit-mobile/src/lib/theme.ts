import type { TextStyle } from "react-native";

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
  // Fourth step of the elevation ramp, for a surface stacked on an elevated
  // one (a sheet's rows, a card inside a card).
  surfaceHigh: "#242429",
  border: "#26262b",
  // For borders on elevated surfaces, where the base border disappears.
  borderStrong: "#33333a",
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

/**
 * Archivo for anything that carries hierarchy (names, headings, counts) and
 * the system face for running text. A grotesk at display sizes with tight
 * tracking is what gives a screen a voice; body copy is left to the face the
 * platform already renders best at 14pt.
 *
 * Loaded in the root layout. Referencing a family here that is not loaded
 * there silently falls back to the system face.
 */
export const fonts = {
  display: "Archivo_700Bold",
  displayHeavy: "Archivo_800ExtraBold",
  displayMedium: "Archivo_600SemiBold",
} as const;

/**
 * The type scale. Display steps carry negative tracking, which is what makes
 * a grotesk read as deliberate rather than merely large; body steps do not,
 * because tight tracking hurts reading at small sizes.
 */
export const type: Record<
  "hero" | "title" | "heading" | "label" | "name" | "count",
  TextStyle
> = {
  hero: { fontFamily: fonts.displayHeavy, fontSize: 30, letterSpacing: -0.8 },
  title: { fontFamily: fonts.display, fontSize: 21, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.display, fontSize: 16.5, letterSpacing: -0.3 },
  // Section labels and metadata: small, wide, uppercase. The editorial
  // counterweight to the tight display sizes.
  label: {
    fontFamily: fonts.displayMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  name: { fontFamily: fonts.display, fontSize: 14.5, letterSpacing: -0.2 },
  count: {
    fontFamily: fonts.displayMedium,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
};

/**
 * Four steps of elevation, so a card reads as an object sitting on the
 * background rather than a region fenced off by a hairline. Each step pairs
 * a surface with the border that reads correctly against it.
 */
export const elevation = {
  base: { backgroundColor: colors.background },
  low: { backgroundColor: colors.surface, borderColor: colors.border },
  mid: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
  high: { backgroundColor: colors.surfaceHigh, borderColor: colors.borderStrong },
} as const;
