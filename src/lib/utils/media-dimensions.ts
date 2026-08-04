/**
 * Reads the intrinsic size of a picked file before it is uploaded, so
 * post_media.width and post_media.height are populated and every surface can
 * reserve the right box before the bytes arrive.
 *
 * Browser only: each helper decodes through a DOM element.
 */

export interface MediaDimensions {
  width: number;
  height: number;
}

/** Frame offset for the generated poster. Time zero is often a black frame. */
const POSTER_TIME_SECONDS = 0.5;
const POSTER_QUALITY = 0.8;
/** Cap on the decode wait, so a broken file cannot stall a publish. */
const DECODE_TIMEOUT_MS = 10_000;

function withTimeout<T>(work: Promise<T>): Promise<T | null> {
  return Promise.race([
    work,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), DECODE_TIMEOUT_MS)),
  ]).catch(() => null);
}

function readImageDimensions(objectUrl: string): Promise<MediaDimensions | null> {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.onerror = () => resolve(null);
    probe.src = objectUrl;
  });
}

function loadVideoMetadata(objectUrl: string): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.muted = true;
    probe.playsInline = true;
    probe.crossOrigin = "anonymous";
    probe.onloadedmetadata = () => resolve(probe);
    probe.onerror = () => resolve(null);
    probe.src = objectUrl;
  });
}

/**
 * Intrinsic pixel size of an image or video file. Returns null when the
 * browser cannot decode it; callers store null rather than a guess.
 */
export async function readMediaDimensions(file: File): Promise<MediaDimensions | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("video/")) {
      const probe = await withTimeout(loadVideoMetadata(objectUrl));
      if (!probe?.videoWidth || !probe.videoHeight) return null;
      return { width: probe.videoWidth, height: probe.videoHeight };
    }
    const size = await withTimeout(readImageDimensions(objectUrl));
    return size?.width && size.height ? size : null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Grabs a poster frame from a video file as a JPEG, ready to upload into
 * post_media.thumbnail_url. Returns null when the frame cannot be read,
 * which includes any browser that refuses to seek the object URL: a missing
 * poster costs polish, a thrown error would cost the user their post.
 */
export async function captureVideoPoster(file: File): Promise<File | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const probe = await withTimeout(loadVideoMetadata(objectUrl));
    if (!probe?.videoWidth || !probe.videoHeight) return null;

    const seeked = await withTimeout(
      new Promise<HTMLVideoElement>((resolve, reject) => {
        probe.onseeked = () => resolve(probe);
        probe.onerror = () => reject(new Error("Video seek failed"));
        probe.currentTime = Math.min(POSTER_TIME_SECONDS, probe.duration || POSTER_TIME_SECONDS);
      }),
    );
    if (!seeked) return null;

    const canvas = document.createElement("canvas");
    canvas.width = seeked.videoWidth;
    canvas.height = seeked.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(seeked, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", POSTER_QUALITY),
    );
    if (!blob) return null;

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-poster.jpg`, {
      type: "image/jpeg",
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
