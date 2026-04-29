import { O, aurora } from "@/lib/design/orbit";
import { formatNumber } from "@/lib/utils/format";

type StatItem = { n: number; label: string; onClick?: () => void };

export function StatCluster({
  items,
  divider = true,
  size = 30,
}: {
  items: StatItem[];
  divider?: boolean;
  size?: number;
}) {
  return (
    <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
      {items.map((item, i) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          disabled={!item.onClick}
          style={{
            borderLeft:
              divider && i > 0 ? `1px solid ${O.hair}` : "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            background: "transparent",
            border: 0,
            color: "inherit",
            textAlign: "center",
            cursor: item.onClick ? "pointer" : "default",
            padding: divider && i > 0 ? "0 0 0 32px" : 0,
          }}
          className={item.onClick ? "hover:opacity-80 transition-opacity" : ""}
        >
          <div
            style={{
              fontFamily: O.serif,
              fontStyle: "italic",
              fontSize: size,
              fontWeight: 700,
              // Italic serif glyphs (especially "1") have ascenders that
              // poke above the cap height; lineHeight needs headroom or
              // they get clipped at the top of the box.
              lineHeight: 1.35,
              paddingTop: 4,
              background: aurora,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.015em",
              textAlign: "center",
            }}
          >
            {formatNumber(item.n)}
          </div>
          <div
            style={{
              fontFamily: O.mono,
              fontSize: 10.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: O.ink3,
              textAlign: "center",
            }}
          >
            {item.label}
          </div>
        </button>
      ))}
    </div>
  );
}
