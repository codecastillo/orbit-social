import { Directory, File, Paths } from "expo-file-system";

// Voice clips are downloaded here when a conversation loads so playback starts
// from a local file instead of streaming. Best-effort throughout: any failure
// just leaves the bubble playing from the remote URL.
const voiceDir = new Directory(Paths.cache, "voice");

// Remote URL -> local file uri for clips already on disk this session. Lets a
// bubble read its cached uri synchronously on first render.
const resolved = new Map<string, string>();
// In-flight downloads, so two bubbles for the same clip don't both fetch it.
const inFlight = new Map<string, Promise<string | null>>();

function ensureDir(): boolean {
  try {
    voiceDir.create({ intermediates: true, idempotent: true });
    return true;
  } catch {
    return false;
  }
}

/** A stable, filesystem-safe filename for a clip's public URL. */
function cacheFileFor(url: string): File {
  const name = url
    .split("?")[0]
    .split("/")
    .slice(-2)
    .join("_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  return new File(voiceDir, name);
}

/** The local uri for a clip already cached this session, or null if not yet. */
export function localVoiceUri(url: string): string | null {
  return resolved.get(url) ?? null;
}

/**
 * Download voice clips to the local cache so the first tap plays instantly.
 * Skips clips already on disk. Resolves when the batch settles; individual
 * failures are swallowed so one bad clip does not sink the rest.
 */
export async function prefetchVoice(urls: string[]): Promise<void> {
  if (urls.length === 0 || !ensureDir()) return;
  await Promise.all(
    urls.map(async (url) => {
      if (resolved.has(url)) return;
      try {
        const dest = cacheFileFor(url);
        if (dest.exists) {
          resolved.set(url, dest.uri);
          return;
        }

        let pending = inFlight.get(url);
        if (!pending) {
          pending = File.downloadFileAsync(url, dest)
            .then((file) => file.uri)
            .catch(() => null);
          inFlight.set(url, pending);
        }
        const uri = await pending;
        inFlight.delete(url);
        if (uri) resolved.set(url, uri);
      } catch {
        // Leave the clip unresolved; playback streams from the remote URL.
      }
    }),
  );
}
