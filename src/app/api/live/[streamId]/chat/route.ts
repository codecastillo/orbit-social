import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const noStore = { "Cache-Control": "no-store, max-age=0" };

const slowModeMap = new Map<string, number>();

interface ChatPayload {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  content: string;
  timestamp: number;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ streamId: string }> },
) {
  const { streamId } = await context.params;
  if (!streamId) {
    return NextResponse.json(
      { error: "bad_request", detail: "streamId" },
      { status: 400, headers: noStore },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const rawContent = typeof body.content === "string" ? body.content : "";
  const content = rawContent.trim();
  if (!content) {
    return NextResponse.json(
      { error: "validation_failed", detail: "content" },
      { status: 400, headers: noStore },
    );
  }
  if (content.length > 500) {
    return NextResponse.json(
      { error: "validation_failed", detail: "content_too_long" },
      { status: 400, headers: noStore },
    );
  }

  const { data: stream, error: streamErr } = await supabase
    .from("live_streams")
    .select("id, user_id, status, slow_mode_seconds, followers_only_chat")
    .eq("id", streamId)
    .maybeSingle();

  if (streamErr || !stream) {
    return NextResponse.json(
      { error: "not_found", detail: "stream" },
      { status: 404, headers: noStore },
    );
  }

  if (stream.status !== "live") {
    return NextResponse.json(
      { error: "stream_not_live", detail: "Stream is not currently live" },
      { status: 410, headers: noStore },
    );
  }

  const isStreamer = stream.user_id === user.id;

  if (stream.followers_only_chat && !isStreamer) {
    const { data: follow } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", stream.user_id)
      .maybeSingle();

    if (!follow) {
      return NextResponse.json(
        { error: "followers_only", detail: "Only followers can chat in this stream" },
        { status: 403, headers: noStore },
      );
    }
  }

  const slowMode = stream.slow_mode_seconds ?? 0;
  if (slowMode > 0 && !isStreamer) {
    const key = `${streamId}:${user.id}`;
    const last = slowModeMap.get(key) ?? 0;
    const now = Date.now();
    const elapsedMs = now - last;
    const requiredMs = slowMode * 1000;
    if (elapsedMs < requiredMs) {
      const retryAfter = Math.ceil((requiredMs - elapsedMs) / 1000);
      return NextResponse.json(
        {
          error: "slow_mode",
          detail: `Chat slow mode: wait ${retryAfter} second${retryAfter === 1 ? "" : "s"}`,
          retry_after: retryAfter,
        },
        { status: 429, headers: noStore },
      );
    }
    slowModeMap.set(key, now);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const msg: ChatPayload = {
    id: crypto.randomUUID(),
    userId: user.id,
    username: profile?.username ?? "user",
    displayName: profile?.display_name ?? "User",
    avatarUrl: profile?.avatar_url ?? null,
    content,
    timestamp: Date.now(),
  };

  try {
    const admin = createAdminClient();
    const channel = admin.channel(`live-chat:${streamId}`, {
      config: { broadcast: { self: false } },
    });
    await channel.send({
      type: "broadcast",
      event: "chat-message",
      payload: msg,
    });
    await admin.removeChannel(channel);
  } catch (e) {
    console.error("chat broadcast failed", e);
    return NextResponse.json(
      { error: "broadcast_failed", detail: e instanceof Error ? e.message : "unknown" },
      { status: 502, headers: noStore },
    );
  }

  return NextResponse.json({ ok: true, message: msg }, { headers: noStore });
}
