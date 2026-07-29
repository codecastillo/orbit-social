"use client";

import { useEffect } from "react";

// Last-resort boundary: catches crashes in the root layout itself, where no
// app CSS or providers exist, so everything here is inline-styled.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0a0a0b",
          color: "#fafafa",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <p
            style={{
              fontSize: 10.5,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#8b8b92",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            Error
          </p>
          <h1
            style={{
              marginTop: 12,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            Something broke on our side.
          </h1>
          <p
            style={{
              marginTop: 10,
              fontSize: 14,
              lineHeight: 1.55,
              color: "#a1a1aa",
            }}
          >
            The page crashed before it could render. Try again, and if it keeps
            happening, come back in a bit.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 20,
              padding: "11px 22px",
              borderRadius: 8,
              border: "none",
              background: "#8b5cf6",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
