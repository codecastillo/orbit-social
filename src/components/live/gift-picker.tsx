"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift } from "lucide-react";
import { GIFTS, type GiftType } from "@/lib/queries/gifts";
import { cn } from "@/lib/utils";

interface GiftPickerProps {
  onSendGift: (giftType: GiftType) => void;
}

export function GiftPicker({ onSendGift }: GiftPickerProps) {
  const [open, setOpen] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);

  const handleSend = (giftType: GiftType) => {
    onSendGift(giftType);
    setLastSent(giftType);
    setTimeout(() => setLastSent(null), 600);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200",
          open
            ? "bg-primary/20 text-primary shadow-[0_0_16px_oklch(0.623_0.214_259_/_20%)]"
            : "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1] hover:text-white"
        )}
      >
        <Gift className="h-4 w-4" />
        Send Gift
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[280px] rounded-2xl border border-white/[0.1] bg-zinc-900/95 backdrop-blur-xl shadow-2xl p-3"
          >
            <p className="text-xs font-semibold text-zinc-400 mb-2.5 px-1">
              Choose a gift
            </p>

            <div className="grid grid-cols-5 gap-1.5">
              {GIFTS.map((gift) => {
                const isJustSent = lastSent === gift.type;
                return (
                  <button
                    key={gift.type}
                    onClick={() => handleSend(gift.type)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl p-2 transition-all duration-150",
                      isJustSent
                        ? "bg-primary/20 scale-110"
                        : "hover:bg-white/[0.08] active:scale-95"
                    )}
                  >
                    <motion.span
                      className="text-2xl"
                      animate={isJustSent ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.3 }}
                    >
                      {gift.emoji}
                    </motion.span>
                    <span className="text-[10px] font-medium text-zinc-400">
                      {gift.points}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 pt-2 border-t border-white/[0.06]">
              <p className="text-[10px] text-zinc-500 text-center">
                Gifts are visual animations (no real currency)
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
