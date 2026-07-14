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
              divider && i > 0 ? `1px solid var(--border)` : "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            background: "transparent",
            border: 0,
            color: "inherit",
            textAlign: "center",
            cursor: item.onClick ? "pointer" : "default",
            pointerEvents: item.onClick ? "auto" : "none",
            padding: divider && i > 0 ? "8px 0 0 32px" : "8px 0 0 0",
          }}
          className={item.onClick ? "hover:opacity-80 transition-opacity" : ""}
        >
          <div
            style={{
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: size,
              fontWeight: 700,
              lineHeight: 1.2,
              color: "var(--foreground)",
              letterSpacing: "-0.015em",
              textAlign: "center",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatNumber(item.n)}
          </div>
          <div
            style={{
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: 10.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--muted-foreground)",
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
