import { O, aurora } from "@/lib/design/orbit";

export function AuroraBanner({
  height = 200,
  children,
}: {
  height?: number;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        background: aurora,
        overflow: "hidden",
      }}
    >
      {/* Radial gloss */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 70% at 80% 20%, rgba(255,255,255,0.28), transparent 55%)",
          pointerEvents: "none",
        }}
      />
      {/* 45° repeating stripes */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(45deg, transparent 0 40px, ${O.hair} 40px 41px)`,
          pointerEvents: "none",
          opacity: 0.6,
        }}
      />
      {children}
    </div>
  );
}
