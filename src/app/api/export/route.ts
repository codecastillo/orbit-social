/**
 * Assembles a JSON archive of the signed-in user's data and returns it as a
 * download. Everything runs through the user's own client, so RLS scopes each
 * query to rows they can already read. Direct messages are deliberately
 * excluded: conversations belong to every participant, not just the exporter.
 * An email sender exists (src/lib/services/email.ts) but v1 ships as a direct
 * download so the archive never sits in an inbox.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const EXPORT_WINDOW_MS = 10 * 60 * 1000;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { success } = rateLimit(`export:${user.id}`, 1, EXPORT_WINDOW_MS);
  if (!success) {
    return NextResponse.json(
      { error: "You can request one export every 10 minutes." },
      { status: 429 },
    );
  }

  const [
    profile,
    posts,
    following,
    followers,
    bookmarks,
    likes,
    muted,
    blocked,
    impressions,
    actions,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("posts")
      .select(
        `id, content, type, visibility, content_warning, location, poll_data,
         like_count, comment_count, repost_count, view_count, bookmark_count,
         created_at, updated_at,
         post_media (type, url, thumbnail_url, sort_order)`,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("follows")
      .select("created_at, profiles!follows_following_id_fkey (username)")
      .eq("follower_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("follows")
      .select("created_at, profiles!follows_follower_id_fkey (username)")
      .eq("following_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookmarks")
      .select("post_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("post_likes")
      .select("post_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("mutes")
      .select("created_at, profiles!mutes_muted_id_fkey (username)")
      .eq("user_id", user.id),
    supabase
      .from("blocks")
      .select("created_at, profiles!blocks_blocked_id_fkey (username)")
      .eq("blocker_id", user.id),
    supabase
      .from("post_impressions")
      .select(
        `post_id, shown_date, surface, first_shown_at, last_shown_at,
         views, dwell_ms, watch_ms, media_ms, completions`,
      )
      .eq("viewer_id", user.id)
      .order("shown_date", { ascending: false }),
    supabase
      .from("post_actions")
      .select("post_id, action, surface, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const failed = [
    profile,
    posts,
    following,
    followers,
    bookmarks,
    likes,
    muted,
    blocked,
    impressions,
    actions,
  ].find((result) => result.error);
  if (failed) {
    console.error("[export] archive query failed:", failed.error);
    return NextResponse.json({ error: "Could not build export" }, { status: 500 });
  }

  // The to-one profiles joins come back typed loosely without generated DB
  // types; each row carries a single joined profile with a username.
  const usernameOf = (row: { profiles: unknown }) =>
    (row.profiles as { username: string } | null)?.username ?? null;

  const archive = {
    exported_at: new Date().toISOString(),
    user_id: user.id,
    email: user.email ?? null,
    // Direct messages are excluded on purpose; see the module doc comment.
    excludes: ["direct_messages"],
    profile: profile.data,
    posts: posts.data ?? [],
    follows: {
      following: (following.data ?? []).map((row) => ({
        username: usernameOf(row),
        followed_at: row.created_at,
      })),
      followers: (followers.data ?? []).map((row) => ({
        username: usernameOf(row),
        followed_at: row.created_at,
      })),
    },
    bookmarks: bookmarks.data ?? [],
    likes: likes.data ?? [],
    muted: (muted.data ?? []).map((row) => ({
      username: usernameOf(row),
      muted_at: row.created_at,
    })),
    blocked: (blocked.data ?? []).map((row) => ({
      username: usernameOf(row),
      blocked_at: row.created_at,
    })),
    // Reaches back 90 days: older partitions are dropped by the retention
    // job, leaving only per-post totals that name no viewer.
    post_impressions: impressions.data ?? [],
    post_actions: actions.data ?? [],
  };

  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(archive, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="orbit-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
