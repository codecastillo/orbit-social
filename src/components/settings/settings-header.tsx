"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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
    <div className="mb-2.5 flex items-center gap-3">
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
          } else {
            router.push("/settings");
          }
        }}
        className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-lg border border-border bg-surface text-text-secondary"
        aria-label="Back"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
      </button>
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {glyph}&nbsp;&nbsp;SETTINGS · {section.toUpperCase()}
      </p>
    </div>
  );
}
