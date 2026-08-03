"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  EMOJI_GRID,
  REACTION_QUICK_ROW,
  getRecentEmoji,
  isSingleEmoji,
  pushRecentEmoji,
} from "@/lib/reactions/emoji";

interface EmojiPickerPanelProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

// Shared free-emoji panel used by the feed, DM, and story reaction pickers.
// Parents own the open state and absolute positioning; this renders the
// panel body with its own open animation and outside-click dismissal.
export function EmojiPickerPanel({ onSelect, onClose }: EmojiPickerPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Read once on mount; localStorage is unavailable during SSR, and the
  // list only changes through selections that close the panel anyway.
  const [recents] = useState<string[]>(() => getRecentEmoji());
  const [customValue, setCustomValue] = useState("");

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  const pick = (emoji: string) => {
    pushRecentEmoji(emoji);
    onSelect(emoji);
    onClose();
  };

  const customValid = isSingleEmoji(customValue.trim());

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="w-[264px] rounded-xl bg-card/95 backdrop-blur-xl border border-white/[0.1] p-3 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Quick row */}
      <div className="flex items-center justify-between">
        {REACTION_QUICK_ROW.map(({ emoji, label }) => (
          <button
            key={emoji}
            onClick={() => pick(emoji)}
            title={label}
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-colors hover:bg-muted"
          >
            {emoji}
          </button>
        ))}
      </div>

      {recents.length > 0 && (
        <>
          <div className="mt-2 mb-1 font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Recent
          </div>
          <div className="flex flex-wrap gap-0.5">
            {recents.map((emoji) => (
              <button
                key={emoji}
                onClick={() => pick(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-2 grid max-h-40 grid-cols-8 gap-0.5 overflow-y-auto">
        {EMOJI_GRID.map((emoji) => (
          <button
            key={emoji}
            onClick={() => pick(emoji)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-muted"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Catch-all: any emoji the grid doesn't carry, pasted or typed via
          the OS emoji keyboard */}
      <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2">
        <input
          type="text"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && customValid) {
              e.preventDefault();
              pick(customValue.trim());
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
          placeholder="Any emoji..."
          maxLength={16}
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-surface px-2.5 text-[13px] text-foreground placeholder:text-text-faint focus:border-primary/50 focus:outline-none transition-colors"
        />
        <button
          onClick={() => customValid && pick(customValue.trim())}
          disabled={!customValid}
          className="h-8 rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
        >
          Use
        </button>
      </div>
    </motion.div>
  );
}
