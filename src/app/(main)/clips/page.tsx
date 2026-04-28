"use client";

import { ClipFeed } from "@/components/clips/clip-feed";
import { O } from "@/lib/design/orbit";

export default function ClipsPage() {
  return (
    <div
      className="relative h-dvh w-full overflow-hidden"
      style={{ background: O.bg }}
    >
      <ClipFeed />
    </div>
  );
}
