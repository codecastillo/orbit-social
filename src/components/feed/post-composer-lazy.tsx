"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useUIStore } from "@/lib/stores/ui-store";

// The composer is ~1300 lines and drags in framer-motion, the audio
// recorder, moderation, and AI captions. Mounted eagerly in the (main)
// layout it shipped on every signed-in route; loading it on first open
// keeps all of that out of the shared bundle.
const PostComposer = dynamic(
  () => import("./post-composer").then((m) => m.PostComposer),
  { ssr: false },
);

export function LazyPostComposer() {
  const composeOpen = useUIStore((s) => s.composeOpen);
  const [everOpened, setEverOpened] = useState(false);

  // Adjust-state-during-render: latch on first open, then stay mounted so
  // the dialog's close animation and draft state survive re-closes.
  if (composeOpen && !everOpened) setEverOpened(true);

  if (!everOpened) return null;
  return <PostComposer />;
}
