"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  REACTION_EMOJI,
  REACTION_LABELS,
  type ReactionType,
} from "@/lib/queries/reactions";

interface ReactionPickerProps {
  onSelect: (type: ReactionType) => void;
  currentReaction?: ReactionType | null;
}

const REACTIONS: ReactionType[] = [
  "love",
  "fire",
  "laugh",
  "sad",
  "wow",
  "angry",
];

export function ReactionPicker({
  onSelect,
  currentReaction,
}: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 300);
  };

  const handleSelect = (type: ReactionType) => {
    onSelect(type);
    setIsOpen(false);
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
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-full left-0 mb-2 z-50"
          >
            <div className="flex items-center gap-0.5 rounded-full bg-card/95 backdrop-blur-xl border border-white/[0.1] px-2 py-1.5 shadow-xl">
              {REACTIONS.map((type, i) => (
                <motion.button
                  key={type}
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
                    handleSelect(type);
                  }}
                  className={`group relative flex items-center justify-center h-9 w-9 rounded-full transition-colors ${
                    currentReaction === type
                      ? "bg-white/[0.12]"
                      : "hover:bg-white/[0.08]"
                  }`}
                  title={REACTION_LABELS[type]}
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
                    {REACTION_EMOJI[type]}
                  </motion.span>

                  {/* Tooltip */}
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-foreground text-background opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {REACTION_LABELS[type]}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
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

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1.5 -ml-1">
      {sorted.map(({ reaction_type, count }) => (
        <button
          key={reaction_type}
          onClick={(e) => {
            e.stopPropagation();
            onReactionClick?.(reaction_type);
          }}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] transition-colors ${
            userReaction === reaction_type
              ? "bg-primary/15 border border-primary/30 text-primary"
              : "bg-white/[0.05] border border-white/[0.08] text-muted-foreground hover:bg-white/[0.08]"
          }`}
        >
          <span>{REACTION_EMOJI[reaction_type]}</span>
          <span className="font-medium">{count}</span>
        </button>
      ))}
    </div>
  );
}
