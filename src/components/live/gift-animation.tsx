"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { SentGift } from "@/lib/queries/gifts";

interface GiftAnimationProps {
  gifts: SentGift[];
  onComplete: (id: string) => void;
}

export function GiftAnimation({ gifts, onComplete }: GiftAnimationProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {gifts.map((sentGift) => {
          // Randomize horizontal position so simultaneous gifts spread out
          const xStart = 20 + Math.random() * 60; // 20%–80% of width

          return (
            <motion.div
              key={sentGift.id}
              initial={{ opacity: 1, y: 0, x: `${xStart}vw`, scale: 0.5 }}
              animate={{
                opacity: [1, 1, 0],
                y: [0, -120, -300],
                scale: [0.5, 1.4, 0.8],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.2, ease: "easeOut" }}
              onAnimationComplete={() => onComplete(sentGift.id)}
              className="absolute bottom-32 flex flex-col items-center"
            >
              <span className="text-5xl drop-shadow-lg">
                {sentGift.gift.emoji}
              </span>
              <span className="mt-1 text-xs font-bold text-white drop-shadow-md">
                {sentGift.gift.name}
              </span>
              <span className="text-[10px] font-medium text-white/70 drop-shadow-md">
                +{sentGift.gift.points} pts
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
