import { O, aurora } from "@/lib/design/orbit";
import { formatNumber } from "@/lib/utils/format";

type StatItem = { n: number; label: string };

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
        <div
          key={item.label}
          style={{
            paddingLeft: divider && i > 0 ? 32 : 0,
            borderLeft:
              divider && i > 0 ? `1px solid ${O.hair}` : "none",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
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
        </div>
      ))}
    </div>
  );
}
