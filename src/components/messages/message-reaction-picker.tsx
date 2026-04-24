"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MessageReactionPickerProps {
  onSelect: (emoji: string) => void;
  existingEmojis?: string[];
}

const MESSAGE_REACTIONS = [
  { emoji: "\u2764\uFE0F", label: "Love" },
  { emoji: "\uD83D\uDC4D", label: "Thumbs Up" },
  { emoji: "\uD83D\uDE02", label: "Laugh" },
  { emoji: "\uD83D\uDE2E", label: "Wow" },
  { emoji: "\uD83D\uDE22", label: "Sad" },
  { emoji: "\uD83D\uDD25", label: "Fire" },
];

export function MessageReactionPicker({
  onSelect,
  existingEmojis = [],
}: MessageReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 300);
  };

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setIsOpen(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="h-7 w-7 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] transition-colors opacity-0 group-hover:opacity-100"
        title="React"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3.5 w-3.5 text-muted-foreground"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.536-4.464a.75.75 0 10-1.06-1.06 3.5 3.5 0 01-4.95 0 .75.75 0 00-1.06 1.06 5 5 0 007.07 0zM9 8.5c0 .828-.448 1.5-1 1.5s-1-.672-1-1.5S7.448 7 8 7s1 .672 1 1.5zm3 1.5c.552 0 1-.672 1-1.5S12.552 7 12 7s-1 .672-1 1.5.448 1.5 1 1.5z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute bottom-full mb-1 z-50 left-1/2 -translate-x-1/2"
          >
            <div className="flex items-center gap-0.5 rounded-full bg-card/95 backdrop-blur-xl border border-white/[0.1] px-1.5 py-1 shadow-xl">
              {MESSAGE_REACTIONS.map(({ emoji, label }, i) => {
                const isActive = existingEmojis.includes(emoji);
                return (
                  <motion.button
                    key={emoji}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      delay: i * 0.03,
                      type: "spring",
                      stiffness: 500,
                      damping: 20,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(emoji);
                    }}
                    className={`flex items-center justify-center h-7 w-7 rounded-full transition-colors ${
                      isActive
                        ? "bg-white/[0.12]"
                        : "hover:bg-white/[0.08]"
                    }`}
                    title={label}
                  >
                    <motion.span
                      className="text-base"
                      whileHover={{ scale: 1.3 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 15,
                      }}
                    >
                      {emoji}
                    </motion.span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface MessageReactionsDisplayProps {
  reactions: { emoji: string; count: number; hasReacted: boolean }[];
  onToggle: (emoji: string) => void;
}

export function MessageReactionsDisplay({
  reactions,
  onToggle,
}: MessageReactionsDisplayProps) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5 flex-wrap mt-1">
      {reactions.map(({ emoji, count, hasReacted }) => (
        <button
          key={emoji}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(emoji);
          }}
          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition-colors ${
            hasReacted
              ? "bg-primary/15 border border-primary/30"
              : "bg-white/[0.06] border border-white/[0.06] hover:bg-white/[0.1]"
          }`}
        >
          <span>{emoji}</span>
          <span className="font-medium">{count}</span>
        </button>
      ))}
    </div>
  );
}
