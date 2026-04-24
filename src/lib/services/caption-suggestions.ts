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
