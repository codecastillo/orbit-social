/**
 * Caption suggestion engine — client-side, no AI API needed.
 * Returns contextual caption ideas based on time of day and attached media.
 */

interface CaptionContext {
  hasImage: boolean;
  hasVideo: boolean;
  /** ISO time string or hour (0-23) */
  time: string;
}

function getHour(time: string): number {
  const d = new Date(time);
  if (isNaN(d.getTime())) {
    const n = parseInt(time, 10);
    return isNaN(n) ? new Date().getHours() : n;
  }
  return d.getHours();
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ---------------------------------------------------------------------------
// Caption pools
// ---------------------------------------------------------------------------

const MORNING_CAPTIONS = [
  "Good morning! ☀️",
  "Rise and grind",
  "Morning vibes",
  "Starting the day right",
  "Coffee first, everything else later",
  "New day, new energy",
];

const AFTERNOON_CAPTIONS = [
  "Afternoon mood",
  "Midday thoughts",
  "Just another beautiful day",
  "Living in the moment",
  "Making the most of today",
];

const EVENING_CAPTIONS = [
  "Night vibes",
  "Evening mood",
  "Winding down",
  "Golden hour",
  "Sunset state of mind",
  "Good night!",
];

const IMAGE_CAPTIONS = [
  "Check this out!",
  "No caption needed",
  "Thoughts?",
  "This speaks for itself",
  "Dump",
  "Caught on camera",
  "Frame-worthy",
  "In my element",
];

const VIDEO_CAPTIONS = [
  "Watch this!",
  "Had to share this",
  "POV:",
  "You need to see this",
  "Wait for it...",
  "This is everything",
];

const GENERAL_CAPTIONS = [
  "Living my best life",
  "Main character energy",
  "No thoughts, just vibes",
  "It's giving",
  "That's a wrap",
  "Period.",
  "Felt cute, might delete later",
  "Less is more",
  "Just because",
  "Note to self",
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * AI-powered caption suggestions. Sends a downsized image (or first frame
 * of a video) to the server, which calls Claude Haiku 4.5 with vision.
 * Returns 3 captions tailored to the actual content. Throws on failure
 * so callers can fall back to suggestCaptions().
 */
export async function suggestCaptionsAI(
  file: File,
  isVideo: boolean,
): Promise<string[]> {
  const imageDataUrl = isVideo
    ? await extractVideoFrame(file)
    : await downsizeImage(file);

  const res = await fetch("/api/captions/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl, isVideo }),
  });
  if (!res.ok) {
    throw new Error(`caption api ${res.status}`);
  }
  const data = (await res.json()) as { captions: string[] };
  return data.captions;
}

async function extractVideoFrame(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => {
        video.currentTime = Math.min(1, (video.duration || 0) / 2);
      };
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("video load failed"));
    });
    const maxDim = 512;
    const ratio = Math.min(
      1,
      maxDim / Math.max(video.videoWidth || maxDim, video.videoHeight || maxDim),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((video.videoWidth || maxDim) * ratio));
    canvas.height = Math.max(1, Math.round((video.videoHeight || maxDim) * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.75);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function downsizeImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
    });
    const maxDim = 512;
    const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * ratio));
    canvas.height = Math.max(1, Math.round(img.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.75);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Returns 3 suggested caption ideas based on context.
 */
export function suggestCaptions(context: CaptionContext): string[] {
  const hour = getHour(context.time);
  const pool: string[] = [];

  // Time-based suggestions
  if (hour >= 5 && hour < 12) {
    pool.push(...pickRandom(MORNING_CAPTIONS, 2));
  } else if (hour >= 12 && hour < 17) {
    pool.push(...pickRandom(AFTERNOON_CAPTIONS, 2));
  } else {
    pool.push(...pickRandom(EVENING_CAPTIONS, 2));
  }

  // Media-based suggestions
  if (context.hasVideo) {
    pool.push(...pickRandom(VIDEO_CAPTIONS, 2));
  } else if (context.hasImage) {
    pool.push(...pickRandom(IMAGE_CAPTIONS, 2));
  }

  // Always mix in some general captions
  pool.push(...pickRandom(GENERAL_CAPTIONS, 2));

  // Pick 3 unique suggestions from the pool
  return pickRandom(pool, 3);
}
