import Mux from "@mux/mux-node";

let cached: Mux | null = null;

export function getMux() {
  if (cached) return cached;
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET must be set");
  }
  cached = new Mux({ tokenId, tokenSecret });
  return cached;
}

export interface MuxLiveStreamCreated {
  muxLiveStreamId: string;
  muxPlaybackId: string;
  streamKey: string;
  rtmpsUrl: string;
  srtUrl: string;
}

export async function createMuxLiveStream(): Promise<MuxLiveStreamCreated> {
  const mux = getMux();
  const stream = await mux.video.liveStreams.create({
    playback_policy: ["public"],
    new_asset_settings: { playback_policy: ["public"] },
    latency_mode: "low",
    reconnect_window: 60,
  });

  const playbackId = stream.playback_ids?.[0]?.id;
  if (!playbackId || !stream.stream_key) {
    throw new Error("Mux stream creation returned no playback_id or stream_key");
  }

  return {
    muxLiveStreamId: stream.id,
    muxPlaybackId: playbackId,
    streamKey: stream.stream_key,
    rtmpsUrl: "rtmps://global-live.mux.com:443/app",
    srtUrl: `srt://global-live.mux.com:6001?streamid=${stream.stream_key}`,
  };
}

export async function deleteMuxLiveStream(muxLiveStreamId: string) {
  const mux = getMux();
  await mux.video.liveStreams.delete(muxLiveStreamId);
}

export function getMuxThumbnailUrl(
  playbackId: string,
  opts: { time?: number; width?: number } = {},
): string {
  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(opts.width));
  if (opts.time !== undefined) params.set("time", String(opts.time));
  const qs = params.toString();
  return `https://image.mux.com/${playbackId}/thumbnail.jpg${qs ? "?" + qs : ""}`;
}

export function getMuxLiveThumbnailUrl(
  playbackId: string,
  opts: { width?: number; height?: number; refreshSeconds?: number } = {},
): string {
  const width = opts.width ?? 640;
  const height = opts.height ?? 360;
  const refresh = opts.refreshSeconds ?? 30;
  const bucket = Math.floor(Date.now() / (refresh * 1000));
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    fit_mode: "smartcrop",
    time: String(bucket),
  });
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?${params.toString()}`;
}

export async function unwrapMuxWebhook(
  body: string,
  signatureHeader: string | null,
) {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return null;
  try {
    const mux = getMux();
    return await mux.webhooks.unwrap(body, { "mux-signature": signatureHeader }, secret);
  } catch (e) {
    console.error("Mux webhook unwrap failed", e);
    return null;
  }
}
