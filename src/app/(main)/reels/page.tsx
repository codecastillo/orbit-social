"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ReelFeed } from "@/components/reels/reel-feed";
import { ReelCreator } from "@/components/reels/reel-creator";

export default function ReelsPage() {
  const [creatorOpen, setCreatorOpen] = useState(false);

  return (
    <div className="relative h-dvh w-full bg-black overflow-hidden">
      <ReelFeed />

      {/* Upload button */}
      <button
        onClick={() => setCreatorOpen(true)}
        className="absolute top-5 left-5 z-20 rounded-full bg-white/20 backdrop-blur-sm p-2.5 text-white hover:bg-white/30 transition-colors"
      >
        <Plus className="size-6" />
      </button>

      <ReelCreator open={creatorOpen} onOpenChange={setCreatorOpen} />
    </div>
  );
}
