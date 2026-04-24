/**
 * Check if a URL points to an audio file based on extension
 */
export function isAudioUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".webm") ||
    lower.endsWith(".mp3") ||
    lower.endsWith(".ogg") ||
    lower.endsWith(".m4a") ||
    lower.endsWith(".mp4") ||
    lower.endsWith(".wav") ||
    lower.includes("audio")
  );
}

/**
 * Check if a message is an audio message
 */
export function isAudioMessage(
  content: string | null,
  mediaUrl: string | null
): boolean {
  if (content?.startsWith("[audio]")) return true;
  if (mediaUrl) {
    const lower = mediaUrl.toLowerCase();
    return (
      lower.endsWith(".webm") ||
      lower.endsWith(".mp3") ||
      lower.endsWith(".ogg") ||
      lower.endsWith(".m4a") ||
      lower.endsWith(".wav")
    );
  }
  return false;
}

/**
 * Check if a post media item is audio
 */
export function isAudioMediaItem(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".webm") ||
    lower.endsWith(".mp3") ||
    lower.endsWith(".ogg") ||
    lower.endsWith(".m4a") ||
    lower.endsWith(".wav")
  );
}

/**
 * Format seconds into mm:ss
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Get the audio file extension for naming
 */
export function getAudioExtension(): string {
  if (typeof MediaRecorder === "undefined") return "webm";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "webm";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "m4a";
  return "webm";
}

/**
 * Generate simple waveform bars from audio data (visual-only, no real analysis)
 */
export function generateWaveformBars(count: number): number[] {
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    // Generate a natural-looking waveform pattern
    const base = 0.3 + Math.random() * 0.5;
    const wave = Math.sin(i / count * Math.PI) * 0.3;
    bars.push(Math.min(1, Math.max(0.1, base + wave)));
  }
  return bars;
}
