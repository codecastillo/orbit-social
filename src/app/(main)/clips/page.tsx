"use client";

import { ClipFeed } from "@/components/clips/clip-feed";

export default function ClipsPage() {
  return (
    <div className="fixed top-14 bottom-24 left-0 right-0 lg:left-[296px] lg:right-6 lg:top-6 lg:bottom-6 z-20 overflow-hidden rounded-2xl bg-black">
      <ClipFeed />
    </div>
  );
}
