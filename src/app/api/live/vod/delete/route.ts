import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteMuxAsset } from "@/lib/services/mux";

const noStore = { "Cache-Control": "no-store, max-age=0" };

// Owner-only delete for a past stream. RLS already enforces ownership on
// the row delete; we double-check up front so we can return a clean 403
// instead of a silent zero-row delete, and so we can grab `mux_asset_id`
// to clean up storage on Mux's side.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: noStore },
    );
  }

  let vodId: string | undefined;
  try {
    const body = await request.json();
    vodId = typeof body?.vodId === "string" ? body.vodId : undefined;
  } catch {
    /* fallthrough → 400 below */
  }
  if (!vodId) {
    return NextResponse.json(
      { error: "missing_vod_id" },
      { status: 400, headers: noStore },
    );
  }

  const { data: vod, error: lookupErr } = await supabase
    .from("live_vods")
    .select("id, user_id, mux_asset_id")
    .eq("id", vodId)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json(
      { error: "lookup_failed" },
      { status: 500, headers: noStore },
    );
  }
  if (!vod) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: noStore },
    );
  }
  if (vod.user_id !== user.id) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403, headers: noStore },
    );
  }

  // Best-effort Mux cleanup. If Mux 404s (already deleted) or 5xxs we
  // still drop the row, leaving an orphan DB row is worse UX than
  // leaving a stale Mux asset.
  if (vod.mux_asset_id) {
    try {
      await deleteMuxAsset(vod.mux_asset_id);
    } catch (err) {
      console.error("VOD delete: Mux asset cleanup failed", err);
    }
  }

  const { error: deleteErr } = await supabase
    .from("live_vods")
    .delete()
    .eq("id", vodId);

  if (deleteErr) {
    return NextResponse.json(
      { error: "delete_failed" },
      { status: 500, headers: noStore },
    );
  }

  return NextResponse.json({ ok: true }, { headers: noStore });
}
