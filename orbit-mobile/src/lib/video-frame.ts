import { useEffect, useState } from "react";
import * as VideoThumbnails from "expo-video-thumbnails";

// Storage-hosted videos often have no stored thumbnail; grabbing a frame
// on-device fills the tile. Cached per URL so scrolling never regenerates.
const frameCache = new Map<string, string>();

/**
 * One-shot frame grab for non-hook callers (the story composer thumbnails
 * a picked video before upload). Shares the cache with useVideoFrame.
 */
export async function captureVideoFrame(url: string): Promise<string> {
  const cached = frameCache.get(url);
  if (cached) return cached;
  const { uri } = await VideoThumbnails.getThumbnailAsync(url, { time: 500 });
  frameCache.set(url, uri);
  return uri;
}

export function useVideoFrame(url: string | null): string | null {
  const [frame, setFrame] = useState<string | null>(
    url ? (frameCache.get(url) ?? null) : null,
  );
  useEffect(() => {
    if (!url || frameCache.has(url)) return;
    let cancelled = false;
    VideoThumbnails.getThumbnailAsync(url, { time: 500 })
      .then(({ uri }) => {
        frameCache.set(url, uri);
        if (!cancelled) setFrame(uri);
      })
      .catch(() => {
        // Tile keeps its dark placeholder; nothing actionable.
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return frame;
}
