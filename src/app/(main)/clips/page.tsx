"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ClipFeed } from "@/components/clips/clip-feed";
import { ClipCreator } from "@/components/clips/clip-creator";
import { O, aurora } from "@/lib/design/orbit";

export default function ClipsPage() {
  const [creatorOpen, setCreatorOpen] = useState(false);

  return (
    <div
      className="relative h-dvh w-full overflow-hidden"
      style={{ background: O.bg }}
    >
      <ClipFeed />

      <button
        onClick={() => setCreatorOpen(true)}
        aria-label="New clip"
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 20,
          width: 42,
          height: 42,
          borderRadius: "50%",
          background: aurora,
          border: "1px solid rgba(255,255,255,0.18)",
          display: "grid",
          placeItems: "center",
          color: "white",
          boxShadow: `0 10px 28px -8px ${O.a2}80`,
          cursor: "pointer",
        }}
      >
        <Plus style={{ width: 20, height: 20 }} strokeWidth={2.2} />
      </button>

      <ClipCreator open={creatorOpen} onOpenChange={setCreatorOpen} />
    </div>
  );
}
