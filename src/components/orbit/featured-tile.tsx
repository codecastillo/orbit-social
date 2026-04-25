import { O, panel } from "@/lib/design/orbit";

export function FeaturedTile({
  media,
  children,
  mediaPosition = "right",
  columns = "1.1fr 1fr",
  minMediaHeight,
  style,
}: {
  media: React.ReactNode;
  children: React.ReactNode;
  mediaPosition?: "left" | "right";
  columns?: string;
  minMediaHeight?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        ...panel({ borderRadius: 24 }),
        padding: 0,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: columns,
        ...style,
      }}
    >
      {mediaPosition === "left" && (
        <div style={{ minHeight: minMediaHeight, position: "relative" }}>
          {media}
        </div>
      )}
      <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
      {mediaPosition === "right" && (
        <div
          style={{
            minHeight: minMediaHeight,
            position: "relative",
            background: O.glass2,
          }}
        >
          {media}
        </div>
      )}
    </div>
  );
}
