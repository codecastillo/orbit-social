import { ImageResponse } from "next/og";

export const alt = "Orbit: The internet, but smaller";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori supports neither CSS variables nor color-mix, so the brand values
// are literal here: violet oklch(0.68 0.19 300) ~ #ac77fa on the dark
// background oklch(0.15 0.004 300) ~ #0b0b0d.
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
          background: "#0b0b0d",
          color: "#f0eff2",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "#ac77fa",
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
            but <span style={{ color: "#ac77fa" }}>smaller</span>.
          </span>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 26,
            color: "#a5a3a8",
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
