import { O } from "@/lib/design/orbit";

export function VerifiedStar({
  size = 12,
  color,
}: {
  size?: number;
  color?: string;
}) {
  return (
    // fill must be a style, not a presentation attribute: attributes reject
    // var() and would render the star black.
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ fill: color || O.a3 }} aria-hidden>
      <path d="M12 2l2.39 7.36H22l-6.18 4.49L18.21 21 12 16.51 5.79 21l2.39-7.15L2 9.36h7.61z" />
    </svg>
  );
}
