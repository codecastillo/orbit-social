import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { AvatarBorderStyle } from "@/lib/queries/profiles";
import { colors } from "@/lib/theme";

const RING_WIDTH = 2;
const RING_INSET = 2;
// Muted ring at 30% alpha. Once stories ship, an active-story ring goes
// full strength; until then every avatar wears the muted frame.
const RING_ALPHA = "4D";

// RN has no gradient primitive without a new dependency, so the web
// UserAvatar's gradient borders flatten to a two-tone ring: the light
// gradient stop fills the frame, the dark stop draws its outer rim.
// gradient-rainbow and animated-glow are legacy stored values.
const BORDER_TONES: Partial<
  Record<AvatarBorderStyle, { fill: string; rim: string }>
> = {
  gold: { fill: "#fcd34d", rim: "#d97706" },
  silver: { fill: "#d4d4d8", rim: "#71717a" },
  diamond: { fill: "#a5f3fc", rim: "#818cf8" },
  "gradient-rainbow": { fill: "#f472b6", rim: colors.primary },
  "animated-glow": { fill: colors.primary, rim: colors.primary },
};

/** Avatar size that fits inside a ring frame of the given outer size. */
export function avatarRingInnerSize(frameSize: number): number {
  return frameSize - (RING_WIDTH + RING_INSET) * 2;
}

/**
 * Circular ring frame around an avatar, the single source of truth for how
 * avatar_border and accent rings render on mobile. A decorative avatar_border
 * and the accent ring are mutually exclusive, same as the web profile hero:
 * a decorative border replaces the frame's fill and rim, otherwise the muted
 * ring picks up the profile accent when one is set.
 */
export function AvatarRing({
  size,
  border,
  accent,
  emphasized = false,
  style,
  children,
}: {
  size: number;
  border?: string | null;
  accent?: string | null;
  /** Full-strength accent ring, for pickers where the muted ring is illegible. */
  emphasized?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const tones = BORDER_TONES[(border ?? "none") as AvatarBorderStyle];
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: RING_WIDTH,
          alignItems: "center",
          justifyContent: "center",
        },
        tones
          ? { backgroundColor: tones.fill, borderColor: tones.rim }
          : {
              borderColor: emphasized
                ? (accent ?? colors.primary)
                : `${accent ?? colors.primary}${RING_ALPHA}`,
              // Opaque so a banner cannot show through the ring inset when
              // the avatar overlaps a cover image.
              backgroundColor: colors.background,
            },
        style,
      ]}
    >
      {children}
    </View>
  );
}
