import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMux } from "@/lib/services/mux";

// Pulls the authoritative duration off Mux for a VOD whose stored
// duration looks wrong (e.g. webhook fired with a partial asset). Called
// from the profile VodCard on mount when duration_seconds is suspect.
export async function POST(request: Request) {
  const { vodId } = await request.json().catch(() => ({}));
  if (!vodId || typeof vodId !== "string") {
    return NextResponse.json({ error: "missing_vod_id" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: vod, error: lookupErr } = await supabase
    .from("live_vods")
    .select("id, mux_asset_id, duration_seconds")
    .eq("id", vodId)
    .maybeSingle();

  if (lookupErr || !vod || !vod.mux_asset_id) {
    return NextResponse.json({ error: "vod_not_found" }, { status: 404 });
  }

  let real: number;
  try {
    const mux = getMux();
    const asset = await mux.video.assets.retrieve(vod.mux_asset_id);
    real = Math.round(asset.duration ?? 0);
  } catch (err) {
    console.error("Mux asset retrieve failed", err);
    return NextResponse.json({ error: "mux_failed" }, { status: 502 });
  }

  if (!Number.isFinite(real) || real <= 0) {
    return NextResponse.json({ ok: true, unchanged: true, real });
  }
  if (real === vod.duration_seconds) {
    return NextResponse.json({ ok: true, unchanged: true, real });
  }

  const { error: updateErr } = await supabase
    .from("live_vods")
    .update({ duration_seconds: real })
    .eq("id", vodId);

  if (updateErr) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, real });
}
