"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { O, aurora } from "@/lib/design/orbit";

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

  // Frame dimensions in CSS pixels — fixed width, height derived from aspect
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
        <div
          style={{
            background: O.bg,
            border: `1px solid ${O.hair2}`,
            borderRadius: 18,
            padding: 20,
            width: "min(92vw, 540px)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              fontFamily: O.sans,
              fontSize: 14,
              fontWeight: 600,
              color: O.ink,
            }}
          >
            {title}
          </div>

          <div
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: frameWidth,
              aspectRatio: `${aspectRatio} / 1`,
              margin: "0 auto",
              overflow: "hidden",
              borderRadius: circular ? "50%" : 14,
              background: "rgba(0,0,0,0.6)",
              cursor: drag ? "grabbing" : "grab",
              touchAction: "none",
              userSelect: "none",
            }}
          >
            {src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                onLoad={onImgLoad}
                draggable={false}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${totalScale})`,
                  transformOrigin: "center",
                  pointerEvents: "none",
                  maxWidth: "none",
                  width: imgSize?.w,
                  height: imgSize?.h,
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
                borderRadius: circular ? "50%" : 14,
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily: O.sans,
              fontSize: 11,
              color: O.ink3,
            }}
          >
            <span>Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: O.a2 }}
            />
            <span style={{ fontFamily: O.mono, minWidth: 34, textAlign: "right" }}>
              {scale.toFixed(2)}×
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{
                padding: "8px 14px",
                borderRadius: 99,
                background: "transparent",
                border: `1px solid ${O.hair2}`,
                color: O.ink2,
                fontFamily: O.sans,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || !imgSize}
              style={{
                padding: "8px 16px",
                borderRadius: 99,
                background: aurora,
                border: "1px solid rgba(255,255,255,0.18)",
                color: "white",
                fontFamily: O.sans,
                fontSize: 13,
                fontWeight: 600,
                cursor: busy ? "default" : "pointer",
                boxShadow: `0 6px 20px -8px ${O.a2}`,
                opacity: busy || !imgSize ? 0.6 : 1,
              }}
            >
              {busy ? "Saving…" : "Save crop"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
