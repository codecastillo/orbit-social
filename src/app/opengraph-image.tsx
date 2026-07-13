import { ImageResponse } from "next/og";

export const alt = "Orbit: The internet, but smaller";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori supports neither CSS variables nor color-mix, so the brand values
// are literal here: ember oklch(0.68 0.21 34) ~ #ff5c38 on the dark
// background oklch(0.15 0.004 80) ~ #141312.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#141312",
          color: "#f4f3f1",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "#ff5c38",
              display: "flex",
            }}
          />
          <div style={{ fontSize: 34, fontWeight: 700 }}>Orbit</div>
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 88,
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-3px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>The internet,</span>
          <span style={{ display: "flex", gap: 20 }}>
            but <span style={{ color: "#ff5c38" }}>smaller</span>.
          </span>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 26,
            color: "#a8a5a0",
            letterSpacing: "2px",
          }}
        >
          EVERYONE&apos;S RADIUS
        </div>
      </div>
    ),
    { ...size }
  );
}
