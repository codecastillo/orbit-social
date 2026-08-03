"use client";

import Image from "next/image";
import { AtSign, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  StoryOverlayPosition,
  StorySelfie,
  StorySticker,
  StoryTextOverlay,
} from "@/lib/queries/stories";

const POSITION_CLASSES: Record<StoryOverlayPosition, string> = {
  top: "top-[12%]",
  center: "top-1/2 -translate-y-1/2",
  bottom: "bottom-[12%]",
};

// Same PiP geometry as the mobile overlay layer (32% width, 3:4, 9% corner
// inset) so a dual-capture moment composites identically on both platforms.
const SELFIE_CORNER_CLASSES: Record<StorySelfie["position"], string> = {
  "top-left": "top-[9%] left-3",
  "top-right": "top-[9%] right-3",
  "bottom-left": "bottom-[9%] left-3",
  "bottom-right": "bottom-[9%] right-3",
};

interface StoryOverlayLayerProps {
  textOverlay: StoryTextOverlay | null;
  stickers: StorySticker[];
  /** Dual-capture front photo rendered as a static corner PiP. */
  selfie?: StorySelfie | null;
  /** Omitted in the creator preview, where chips are inert. */
  onMentionClick?: (username: string) => void;
  onLinkClick?: (url: string) => void;
  className?: string;
}

/**
 * Renders a story's text overlay and sticker chips over the media. One
 * component for both the creator's live preview and the viewer so the two
 * can never drift apart.
 */
export function StoryOverlayLayer({
  textOverlay,
  stickers,
  selfie,
  onMentionClick,
  onLinkClick,
  className,
}: StoryOverlayLayerProps) {
  const positions: StoryOverlayPosition[] = ["top", "center", "bottom"];

  return (
    <div className={cn("pointer-events-none absolute inset-0", className)}>
      {selfie && (
        <div
          className={cn(
            "absolute w-[32%] aspect-[3/4] overflow-hidden rounded-xl",
            "border-2 border-white/90 bg-black/60",
            SELFIE_CORNER_CLASSES[selfie.position]
          )}
        >
          <Image
            src={selfie.url}
            alt="Selfie photo"
            fill
            sizes="20vw"
            className="object-cover"
            draggable={false}
          />
        </div>
      )}
      {positions.map((position) => {
        const text =
          textOverlay?.position === position ? textOverlay : null;
        const positionStickers = stickers.filter(
          (s) => s.position === position
        );
        if (!text && positionStickers.length === 0) return null;

        return (
          <div
            key={position}
            className={cn(
              "absolute inset-x-0 flex flex-col items-center gap-2 px-6",
              POSITION_CLASSES[position]
            )}
          >
            {text && (
              <p
                className={cn(
                  "max-w-full break-words text-center font-semibold text-white",
                  "[text-shadow:0_1px_8px_rgba(0,0,0,0.7)]",
                  text.size === "large" ? "text-2xl" : "text-base"
                )}
              >
                {text.text}
              </p>
            )}
            {positionStickers.map((sticker, i) => (
              <button
                key={`${sticker.type}-${i}`}
                type="button"
                disabled={!onMentionClick && !onLinkClick}
                onClick={() =>
                  sticker.type === "mention"
                    ? onMentionClick?.(sticker.value)
                    : onLinkClick?.(sticker.value)
                }
                className={cn(
                  "pointer-events-auto flex items-center gap-1.5 rounded-full",
                  "bg-black/60 px-3 py-1.5 text-sm font-medium text-white",
                  "backdrop-blur-sm transition enabled:hover:bg-black/80"
                )}
              >
                {sticker.type === "mention" ? (
                  <AtSign className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <LinkIcon className="h-3.5 w-3.5 text-primary" />
                )}
                <span className="max-w-[220px] truncate">
                  {sticker.type === "mention"
                    ? `@${sticker.value}`
                    : sticker.value.replace(/^https?:\/\//, "")}
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
