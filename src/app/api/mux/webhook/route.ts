import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMuxThumbnailUrl, unwrapMuxWebhook } from "@/lib/services/mux";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get("mux-signature");
  const event = await unwrapMuxWebhook(rawBody, sig);
  if (!event) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const supabase = createAdminClient();

  if (event.type === "video.asset.ready") {
    const data = event.data as {
      id?: string;
      live_stream_id?: string;
      duration?: number;
      playback_ids?: Array<{ id: string; policy: string }>;
    };

    const muxAssetId = data.id;
    const muxLiveStreamId = data.live_stream_id;
    if (!muxAssetId || !muxLiveStreamId) {
      return NextResponse.json({ ok: true, ignored: "not_from_live_stream" });
    }

    const { data: liveStream, error: lookupError } = await supabase
      .from("live_streams")
      .select("id, user_id, title, category")
      .eq("mux_live_stream_id", muxLiveStreamId)
      .maybeSingle();

    if (lookupError) {
      console.error("VOD: live_streams lookup failed", lookupError);
      return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
    }
    if (!liveStream) {
      return NextResponse.json({ ok: true, ignored: "orphan_live_stream" });
    }

    const publicPlaybackId = data.playback_ids?.find(
      (p) => p.policy === "public",
    )?.id;
    if (!publicPlaybackId) {
      return NextResponse.json({ ok: true, ignored: "no_public_playback_id" });
    }

    const durationSec = Math.round(data.duration ?? 0);
    const thumbTime = Math.floor((data.duration ?? 30) / 2);
    const thumbnailUrl = getMuxThumbnailUrl(publicPlaybackId, {
      width: 640,
      time: thumbTime,
    });

    const { error: insertError } = await supabase.from("live_vods").insert({
      stream_id: liveStream.id,
      user_id: liveStream.user_id,
      title: liveStream.title,
      category: liveStream.category ?? null,
      mux_asset_id: muxAssetId,
      mux_playback_id: publicPlaybackId,
      duration_seconds: durationSec,
      thumbnail_url: thumbnailUrl,
    });

    if (insertError) {
      const code = (insertError as { code?: string }).code;
      if (code === "23505") {
        return NextResponse.json({ ok: true, ignored: "duplicate_vod" });
      }
      console.error("VOD insert failed", insertError);
      return NextResponse.json({ error: "vod_insert_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, type: event.type });
  }

  const muxLiveStreamId = (event.data as { id?: string } | undefined)?.id;
  if (!muxLiveStreamId) return NextResponse.json({ ok: true });

  const updates: Record<string, unknown> = {};
  switch (event.type) {
    case "video.live_stream.active":
      updates.status = "live";
      updates.started_at = new Date().toISOString();
      break;
    case "video.live_stream.idle":
    case "video.live_stream.disconnected":
      updates.status = "ended";
      updates.ended_at = new Date().toISOString();
      break;
    default:
      return NextResponse.json({ ok: true, ignored: event.type });
  }

  const { error } = await supabase
    .from("live_streams")
    .update(updates)
    .eq("mux_live_stream_id", muxLiveStreamId);

  if (error) {
    console.error("DB update from Mux webhook failed", error);
    return NextResponse.json({ error: "db_update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, type: event.type });
}
