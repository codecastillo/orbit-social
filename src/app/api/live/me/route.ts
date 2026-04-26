import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createMuxLiveStream } from "@/lib/services/mux";
import {
  isLiveCategorySlug,
  isLiveLanguageCode,
  isLiveSlowModeValue,
} from "@/lib/constants/live-categories";

const noStore = { "Cache-Control": "no-store, max-age=0" };

const STREAM_SELECT =
  "id, mux_live_stream_id, mux_playback_id, stream_key, status, title, category, tags, language, slow_mode_seconds, followers_only_chat, mature";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  const { data: existing } = await supabase
    .from("live_streams")
    .select(STREAM_SELECT)
    .eq("user_id", user.id)
    .not("mux_live_stream_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && existing.stream_key && existing.mux_playback_id) {
    return NextResponse.json(
      {
        streamId: existing.id,
        rtmpsUrl: "rtmps://global-live.mux.com:443/app",
        srtUrl: `srt://global-live.mux.com:6001?streamid=${existing.stream_key}`,
        streamKey: existing.stream_key,
        playbackId: existing.mux_playback_id,
        status: existing.status,
        title: existing.title ?? null,
        category: existing.category ?? null,
        tags: existing.tags ?? [],
        language: existing.language ?? "en",
        slowModeSeconds: existing.slow_mode_seconds ?? 0,
        followersOnlyChat: existing.followers_only_chat ?? false,
        mature: existing.mature ?? false,
      },
      { headers: noStore },
    );
  }

  let mux;
  try {
    mux = await createMuxLiveStream();
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("Mux create failed", e);
    return NextResponse.json(
      { error: "mux_create_failed", detail },
      { status: 502, headers: noStore },
    );
  }

  const { data, error } = await supabase
    .from("live_streams")
    .insert({
      user_id: user.id,
      title: null,
      status: "idle",
      mux_live_stream_id: mux.muxLiveStreamId,
      mux_playback_id: mux.muxPlaybackId,
      stream_key: mux.streamKey,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("DB insert failed", error);
    return NextResponse.json(
      { error: "db_insert_failed", detail: error?.message ?? null },
      { status: 500, headers: noStore },
    );
  }

  return NextResponse.json(
    {
      streamId: data.id,
      rtmpsUrl: mux.rtmpsUrl,
      srtUrl: mux.srtUrl,
      streamKey: mux.streamKey,
      playbackId: mux.muxPlaybackId,
      status: "idle",
      title: null,
      category: null,
      tags: [],
      language: "en",
      slowModeSeconds: 0,
      followersOnlyChat: false,
      mature: false,
    },
    { headers: noStore },
  );
}

type StreamUpdate = {
  title?: string;
  category?: string | null;
  tags?: string[];
  language?: string;
  mature?: boolean;
  slow_mode_seconds?: number;
  followers_only_chat?: boolean;
};

function fail(field: string) {
  return NextResponse.json(
    { error: "validation_failed", detail: field },
    { status: 400, headers: noStore },
  );
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const update: StreamUpdate = {};

  if ("title" in body) {
    if (typeof body.title !== "string") return fail("title");
    const trimmed = body.title.trim().slice(0, 100);
    if (!trimmed) return fail("title");
    update.title = trimmed;
  }

  if ("category" in body) {
    if (body.category === null) {
      update.category = null;
    } else if (isLiveCategorySlug(body.category)) {
      update.category = body.category;
    } else {
      return fail("category");
    }
  }

  if ("tags" in body) {
    if (!Array.isArray(body.tags)) return fail("tags");
    const cleaned: string[] = [];
    for (const raw of body.tags) {
      if (typeof raw !== "string") return fail("tags");
      const t = raw.trim().toLowerCase();
      if (!t) continue;
      if (t.length > 20) return fail("tags");
      cleaned.push(t);
    }
    if (cleaned.length > 5) return fail("tags");
    update.tags = cleaned;
  }

  if ("language" in body) {
    if (!isLiveLanguageCode(body.language)) return fail("language");
    update.language = body.language;
  }

  if ("mature" in body) {
    if (typeof body.mature !== "boolean") return fail("mature");
    update.mature = body.mature;
  }

  if ("slow_mode_seconds" in body) {
    if (!isLiveSlowModeValue(body.slow_mode_seconds)) return fail("slow_mode_seconds");
    update.slow_mode_seconds = body.slow_mode_seconds;
  }

  if ("followers_only_chat" in body) {
    if (typeof body.followers_only_chat !== "boolean") return fail("followers_only_chat");
    update.followers_only_chat = body.followers_only_chat;
  }

  if (Object.keys(update).length === 0) {
    return fail("no_fields");
  }

  const { error } = await supabase
    .from("live_streams")
    .update(update)
    .eq("user_id", user.id)
    .not("mux_live_stream_id", "is", null);

  if (error) {
    return NextResponse.json(
      { error: "db_update_failed", detail: error.message },
      { status: 500, headers: noStore },
    );
  }

  return NextResponse.json({ ok: true }, { headers: noStore });
}
