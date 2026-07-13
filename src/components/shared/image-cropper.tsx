"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ImageCropperProps {
  open: boolean;
  file: File | null;
  aspectRatio: number; // e.g. 4 for 4:1 cover, 1 for square avatar
  circular?: boolean; // shows a circle mask, but output is still a square
  outputWidth?: number; // pixel width of the exported image
  title?: string;
  onClose: () => void;
  onComplete: (blob: Blob) => void;
}

export function ImageCropper({
  open,
  file,
  aspectRatio,
  circular = false,
  outputWidth = 1200,
  title = "Crop image",
  onClose,
  onComplete,
}: ImageCropperProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) {
      setSrc(null);
      setImgSize(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  // Frame dimensions in CSS pixels: fixed width, height derived from aspect
  const frameWidth = 480;
  const frameHeight = Math.round(frameWidth / aspectRatio);

  // base scale: cover the frame at scale=1
  const baseScale = imgSize
    ? Math.max(frameWidth / imgSize.w, frameHeight / imgSize.h)
    : 1;
  const totalScale = baseScale * scale;
  const renderedW = imgSize ? imgSize.w * totalScale : 0;
  const renderedH = imgSize ? imgSize.h * totalScale : 0;
  const maxX = Math.max(0, (renderedW - frameWidth) / 2);
  const maxY = Math.max(0, (renderedH - frameHeight) / 2);

  const clamp = (x: number, max: number) => Math.min(max, Math.max(-max, x));

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setOffset({
      x: clamp(e.clientX - drag.x, maxX),
      y: clamp(e.clientY - drag.y, maxY),
    });
  };
  const onPointerUp = () => setDrag(null);

  const handleSave = async () => {
    if (!src || !imgSize) return;
    setBusy(true);
    try {
      const img = new Image();
      img.src = src;
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Failed to load image"));
      });

      const outW = outputWidth;
      const outH = Math.round(outW / aspectRatio);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");

      // The frame is a viewport into the rendered image. Map the visible
      // region in CSS px to the source image px.
      const cssToImg = 1 / totalScale;
      const visX = (renderedW - frameWidth) / 2 - offset.x;
      const visY = (renderedH - frameHeight) / 2 - offset.y;
      const sx = visX * cssToImg;
      const sy = visY * cssToImg;
      const sw = frameWidth * cssToImg;
      const sh = frameHeight * cssToImg;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92)
      );
      if (!blob) throw new Error("Could not encode image");
      onComplete(blob);
      onClose();
    } catch (err) {
      console.error("Crop failed:", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="p-0 gap-0 border-0 bg-transparent shadow-none max-w-none w-auto"
        showCloseButton={false}
      >
        <div className="flex w-[min(92vw,540px)] flex-col gap-3.5 rounded-2xl border border-border bg-surface-elevated p-5">
          <div className="text-sm font-semibold text-foreground">{title}</div>

          <div
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={cn(
              "relative mx-auto w-full max-w-[480px] touch-none select-none overflow-hidden bg-black/60",
              circular ? "rounded-full" : "rounded-xl",
              drag ? "cursor-grabbing" : "cursor-grab"
            )}
            style={{ aspectRatio: `${aspectRatio} / 1` }}
          >
            {src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                onLoad={onImgLoad}
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${totalScale})`,
                  transformOrigin: "center",
                  width: imgSize?.w,
                  height: imgSize?.h,
                }}
              />
            )}
            <div
              className={cn(
                "pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.18]",
                circular ? "rounded-full" : "rounded-xl"
              )}
            />
          </div>

          <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
            <span>Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="min-w-[34px] text-right font-mono">
              {scale.toFixed(2)}×
            </span>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="cursor-pointer rounded-lg border border-border bg-transparent px-3.5 py-2 text-[13px] text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || !imgSize}
              className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:cursor-default disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save crop"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
