import { O } from "@/lib/design/orbit";

export function TrendingRow({
  rank,
  tag,
  posts,
  deltaPercent,
  isTop,
  onClick,
  href,
}: {
  rank: number;
  tag: string;
  posts: string | number;
  deltaPercent?: number;
  isTop?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const clean = tag.startsWith("#") ? tag.slice(1) : tag;
  const Wrap: React.ElementType = href ? "a" : "div";
  return (
    <Wrap
      href={href}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "11px 0",
        color: O.ink,
        textDecoration: "none",
        cursor: href || onClick ? "pointer" : "default",
      }}
    >
      <span
        style={{
          fontFamily: O.serif,
          fontSize: 22,
          fontStyle: "italic",
          color: isTop ? O.a2 : O.ink3,
          minWidth: 22,
          lineHeight: 1,
        }}
      >
        {rank}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>#{clean}</div>
        <div style={{ fontSize: 11, color: O.ink3 }}>{posts} posts</div>
      </div>
      {typeof deltaPercent === "number" && (
        <span
          style={{
            fontSize: 10.5,
            color: "#7dffa3",
            fontFamily: O.mono,
            letterSpacing: "0.04em",
          }}
        >
          ↑ {deltaPercent}%
        </span>
      )}
    </Wrap>
  );
}
