"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Eyebrow } from "@/components/orbit/primitives";
import { O } from "@/lib/design/orbit";

// Shared header for every /settings/<section> page. Gives the same back-tile
// + eyebrow row the profile page uses, so breadcrumbs read consistently
// (`SETTINGS · ACCOUNT` etc., never with a separate "← BACK · SETTINGS"
// line and never in the cyan accent color).
export function SettingsHeader({
  section,
  glyph = "◇",
}: {
  section: string;
  glyph?: string;
}) {
  const router = useRouter();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 10,
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
          } else {
            router.push("/settings");
          }
        }}
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${O.hair2}`,
          color: O.ink2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
        aria-label="Back"
      >
        <ArrowLeft style={{ width: 14, height: 14 }} strokeWidth={1.8} />
      </button>
      <Eyebrow>
        {glyph}&nbsp;&nbsp;SETTINGS · {section.toUpperCase()}
      </Eyebrow>
    </div>
  );
}
