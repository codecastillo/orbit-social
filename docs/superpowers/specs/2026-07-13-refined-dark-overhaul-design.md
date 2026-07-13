# Refined Dark: Orbit UI/UX overhaul design spec

Approved 2026-07-13. Full execution plan lives with the session; this document records the design direction and the decisions behind it.

## Problem

Orbit's visual identity reads as a generic AI-generated product: dark cosmic background, indigo-to-magenta-to-cyan aurora gradient, glassmorphism panels, glow effects, and spinning rainbow borders. The identity also lives in two competing systems (the `src/lib/design/orbit.ts` inline-style token object and an underused shadcn/Tailwind layer), which makes every screen drift further from consistency. The goal is a professional, marketable identity delivered through exactly one design system.

## Direction

- Refined dark: flat surfaces, no gradients, no glassmorphism or backdrop blur on panels, no glow, aurora, or spinning borders. Anchor for restraint: X and Discord. Dark is the flagship theme.
- Light and dark themes from one token layer. Theme infrastructure ships with the foundation; the user-facing toggle is exposed only once core surfaces are verified in light (after the live/VOD batch), because unmigrated pages carry hardcoded dark literals until their batch lands.
- Single flat accent, ember orange-coral. Dark: oklch(0.68 0.21 34), roughly #FF5C38, with a near-black foreground (white on ember fails AA at about 3.1:1; near-black passes at about 6:1). Light: oklch(0.55 0.19 34), roughly #CF4419.
- Typography: Geist for UI and display (weight and tight tracking carry hierarchy), Geist Mono for labels, counters, and eyebrows. Syne and Instrument Serif are removed. No third font.
- Radius: 8px controls, 12px cards, 16px dialogs. Pill shapes only for chips and avatars. Spacing on a 4px grid.
- Motion: purposeful 150-200ms micro-interactions only. Skeleton shimmer and loading spinners are the sanctioned looping animations. `prefers-reduced-motion` is respected.
- Profile personalization stays, constrained: `theme_color` becomes a small curated set of flat, theme-safe colors applied to the avatar ring and profile name tint only. Legacy values map to the nearest curated color. The `animated-glow` avatar border maps to a static ring. Database columns are unchanged.
- No emojis in UI strings. No em dashes in copy.

## Token palette

`:root` is light, `.dark` is dark. Backgrounds carry a faint warm cast (hue about 80, chroma 0.003-0.006) to harmonize with ember.

| Token | Dark (flagship) | Light |
|---|---|---|
| --background | oklch(0.15 0.004 80) | oklch(0.975 0.003 80) |
| --surface / --card | oklch(0.19 0.005 80) | oklch(1 0 0) |
| --surface-elevated / --popover | oklch(0.23 0.006 80) | oklch(1 0 0) |
| --foreground | oklch(0.955 0.004 80) | oklch(0.22 0.012 80) |
| --text-secondary | oklch(0.72 0.008 80) | oklch(0.45 0.012 80) |
| --muted-foreground | oklch(0.55 0.01 80) | oklch(0.55 0.01 80) |
| --text-faint | oklch(0.42 0.008 80) | oklch(0.68 0.008 80) |
| --border | oklch(0.29 0.006 80) | oklch(0.90 0.004 80) |
| --primary (ember) | oklch(0.68 0.21 34) | oklch(0.55 0.19 34) |
| --primary-foreground | oklch(0.16 0.02 34) | oklch(0.99 0.003 80) |
| --destructive | oklch(0.64 0.21 25) | oklch(0.55 0.21 25) |
| --success / --warning / --info | 0.72 / 0.80 / 0.70 lightness, muted | 0.52 / 0.55 / 0.52 lightness |
| --ring | var(--primary) | var(--primary) |

Radius tokens are declared explicitly (no calc scale): `--radius-lg: 0.5rem` and `--radius-xl: 0.75rem`, so `ui/button` (rounded-lg) lands at 8px and `ui/card` (rounded-xl) at 12px with zero component edits. `color-scheme` is set per theme.

## Architecture decisions

- The shadcn vocabulary in `src/components/ui/*` is the canonical primitive layer. The custom orbit primitives are rewritten as thin compatibility shims (same exports and props, flat internals) so their 73 consumer files restyle without call-site churn, then get replaced and deleted batch by batch.
- `src/lib/design/orbit.ts` becomes a bridge during migration: every `O` token resolves to a CSS variable, `panel()` returns flat card styles, `aurora` collapses to the single accent. This instantly removes the aurora/glass look from every unmigrated page and makes them theme-aware. Hex-alpha string concatenations onto tokens (`${O.x}66`) are rewritten to `color-mix()` because a `var()` reference concatenated with hex digits silently invalidates the whole declaration.
- Migration is complete, not partial: when it finishes, `orbit.ts`, `src/components/orbit/`, and all legacy utilities are deleted. A grep-based ratchet script in CI (deny-by-default with a shrinking allowlist) prevents regressions during the mixed period.

## Consequences

- Every headline changes at once when the serif-italic accent (`Acc`) flattens; that is the intended identity shift, not a regression.
- Light theme is imperfect on unmigrated pages until their batch lands; the toggle stays hidden until the core surfaces are verified.
- Full-bleed video surfaces (clips, live player) stay dark in both themes; only surrounding chrome themes.
