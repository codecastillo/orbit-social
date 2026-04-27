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
            paddingLeft: divider && i > 0 ? 32 : 0,
            borderLeft:
              divider && i > 0 ? `1px solid ${O.hair}` : "none",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            background: "transparent",
            border: 0,
            color: "inherit",
            textAlign: "left",
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
              lineHeight: 1.05,
              background: aurora,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.01em",
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
            }}
          >
            {item.label}
          </div>
        </button>
      ))}
    </div>
  );
}
