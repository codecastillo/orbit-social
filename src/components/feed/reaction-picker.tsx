"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmojiPickerPanel } from "@/components/shared/emoji-picker";
import {
  REACTION_QUICK_ROW,
  resolveReactionGlyph,
} from "@/lib/reactions/emoji";
import type { ReactionType } from "@/lib/queries/reactions";

interface ReactionPickerProps {
  onSelect: (type: ReactionType) => void;
  currentReaction?: ReactionType | null;
}

// Pills worth showing inline before collapsing the rest behind a "+N" chip.
const MAX_VISIBLE_REACTION_PILLS = 3;

export function ReactionPicker({
  onSelect,
  currentReaction,
}: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    // The full panel has its own outside-click dismissal; hover-away only
    // collapses the quick row.
    if (panelOpen) return;
    timeoutRef.current = setTimeout(() => setIsOpen(false), 300);
  };

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setIsOpen(false);
    setPanelOpen(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger area, the parent component places its like button here */}
      <div className="relative">
        {/* The children (like button) are rendered by the parent */}
      </div>

      <AnimatePresence>
        {isOpen && !panelOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-full left-0 mb-2 z-50"
          >
            <div className="flex items-center gap-0.5 rounded-full bg-card/95 backdrop-blur-xl border border-white/[0.1] px-2 py-1.5 shadow-xl">
              {REACTION_QUICK_ROW.map(({ emoji, label }, i) => (
                <motion.button
                  key={emoji}
                  initial={{ scale: 0, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{
                    delay: i * 0.04,
                    type: "spring",
                    stiffness: 500,
                    damping: 20,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(emoji);
                  }}
                  className={`group relative flex items-center justify-center h-9 w-9 rounded-full transition-colors ${
                    currentReaction === emoji
                      ? "bg-white/[0.12]"
                      : "hover:bg-muted"
                  }`}
                  title={label}
                >
                  <motion.span
                    className="text-xl"
                    whileHover={{ scale: 1.35, y: -4 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 15,
                    }}
                  >
                    {emoji}
                  </motion.span>

                  {/* Tooltip */}
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-foreground text-background opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {label}
                  </span>
                </motion.button>
              ))}
              <motion.button
                initial={{ scale: 0, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                transition={{
                  delay: REACTION_QUICK_ROW.length * 0.04,
                  type: "spring",
                  stiffness: 500,
                  damping: 20,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setPanelOpen(true);
                }}
                aria-label="More reactions"
                title="More reactions"
                className="flex items-center justify-center h-9 w-9 rounded-full transition-colors hover:bg-muted"
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panelOpen && (
          <div className="absolute bottom-full left-0 mb-2 z-50">
            <EmojiPickerPanel
              onSelect={handleSelect}
              onClose={() => {
                setPanelOpen(false);
                setIsOpen(false);
              }}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ReactionCountsDisplayProps {
  reactions: { reaction_type: ReactionType; count: number }[];
  onReactionClick?: (type: ReactionType) => void;
  userReaction?: ReactionType | null;
}

export function ReactionCountsDisplay({
  reactions,
  onReactionClick,
  userReaction,
}: ReactionCountsDisplayProps) {
  if (!reactions || reactions.length === 0) return null;

  const sorted = [...reactions].sort((a, b) => b.count - a.count);
  const visible = sorted.slice(0, MAX_VISIBLE_REACTION_PILLS);
  const overflow = sorted.slice(MAX_VISIBLE_REACTION_PILLS);

  const pill = ({ reaction_type, count }: { reaction_type: string; count: number }) => (
    <button
      key={reaction_type}
      onClick={(e) => {
        e.stopPropagation();
        onReactionClick?.(reaction_type);
      }}
      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] transition-colors ${
        userReaction === reaction_type
          ? "bg-primary/15 border border-primary/30 text-primary"
          : "bg-muted border border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      <span>{resolveReactionGlyph(reaction_type)}</span>
      <span className="font-medium">{count}</span>
    </button>
  );

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1.5 -ml-1">
      {visible.map(pill)}
      {overflow.length > 0 && (
        <Popover>
          <PopoverTrigger
            onClick={(e) => e.stopPropagation()}
            aria-label="All reactions"
            className="flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-muted border border-border text-muted-foreground hover:bg-accent transition-colors"
          >
            +{overflow.length}
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-auto max-w-[240px] p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap gap-1">{sorted.map(pill)}</div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
