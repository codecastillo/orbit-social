import { useEffect, useState } from "react";
import * as VideoThumbnails from "expo-video-thumbnails";

import { uploadPostMedia } from "@/lib/queries/posts";

export interface VideoPoster {
  uri: string;
  width: number;
  height: number;
}

// Storage-hosted videos often have no stored thumbnail; grabbing a frame
// on-device fills the tile. Cached per URL so scrolling never regenerates.
const frameCache = new Map<string, VideoPoster>();

const POSTER_TIME_MS = 500;

/**
 * Grabs a poster frame and its pixel dimensions. The frame matches the
 * video's own dimensions, which is the only way the camera flows learn
 * their width and height: recordAsync reports neither.
 *
 * Shares the cache with useVideoFrame.
 */
export async function captureVideoPoster(url: string): Promise<VideoPoster> {
  const cached = frameCache.get(url);
  if (cached) return cached;
  const poster = await VideoThumbnails.getThumbnailAsync(url, { time: POSTER_TIME_MS });
  frameCache.set(url, poster);
  return poster;
}

/**
 * Grabs a poster frame for a local video and uploads it to post media.
 * Returns null when either step fails: a missing poster costs a little
 * polish, a failed publish costs the user their post.
 */
export async function uploadVideoPoster(
  userId: string,
  localVideoUri: string,
): Promise<{ url: string; width: number; height: number } | null> {
  try {
    const poster = await captureVideoPoster(localVideoUri);
    const url = await uploadPostMedia(userId, poster.uri, "image/jpeg");
    return { url, width: poster.width, height: poster.height };
  } catch {
    return null;
  }
}

export function useVideoFrame(url: string | null): string | null {
  const [frame, setFrame] = useState<string | null>(
    url ? (frameCache.get(url)?.uri ?? null) : null,
  );
  useEffect(() => {
    if (!url || frameCache.has(url)) return;
    let cancelled = false;
    captureVideoPoster(url)
      .then((poster) => {
        if (!cancelled) setFrame(poster.uri);
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
