"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { MediaItem } from "@/lib/queries/posts";

/**
 * Full-screen image viewer for a post's attachments.
 *
 * Clicking a photo in the feed did nothing at all before this: the grid cell
 * was the largest anyone could see an image, and a portrait photo in a
 * four-up grid was cropped to a square with no way to see the rest of it.
 *
 * Images are contained here rather than cropped, since this is the surface
 * where someone wants the whole photo. Alt text is displayed rather than only
 * announced, because the author wrote it to be read.
 */
export function MediaLightbox({
  media,
  index,
  onIndexChange,
  onClose,
}: {
  media: MediaItem[];
  /** null closes the viewer, so the caller stores one piece of state. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const open = index !== null;
  const [loaded, setLoaded] = useState(false);

  const go = useCallback(
    (delta: number) => {
      if (index === null) return;
      const next = (index + delta + media.length) % media.length;
      setLoaded(false);
      onIndexChange(next);
    },
    [index, media.length, onIndexChange],
  );

  // Keyboard is the point of a desktop viewer: arrows page, Escape leaves.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll while a full-screen layer is up.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, go]);

  if (!open) return null;
  const current = media[index];
  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {media.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-4 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute top-5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-semibold text-white tabular-nums">
            {index + 1} of {media.length}
          </div>
        </>
      )}

      <div
        className="relative flex h-full w-full items-center justify-center p-6 sm:p-12"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          key={current.id}
          src={current.url}
          alt={current.alt_text ?? ""}
          width={current.width ?? 1600}
          height={current.height ?? 1200}
          onLoad={() => setLoaded(true)}
          className={`max-h-full w-auto max-w-full object-contain transition-opacity duration-200 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          // Full-screen, so it is worth the full-resolution fetch.
          sizes="100vw"
          priority
        />
      </div>

      {current.alt_text && (
        <p className="absolute bottom-0 left-0 right-0 bg-black/60 px-6 py-4 text-center text-[13.5px] leading-snug text-white/90">
          {current.alt_text}
        </p>
      )}
    </div>
  );
}
