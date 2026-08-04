/**
 * Story highlights read/write endpoint, shared by web and the native app
 * (native sends the session token as a Bearer header, same as the live
 * chat route).
 *
 * Why this exists instead of direct client queries: story_highlight_items
 * has RLS enabled with only a SELECT policy, so item inserts are denied to
 * every client; and the stories SELECT policy
 * (`expires_at > NOW() OR auth.uid() = user_id`) hides expired rows from
 * everyone but their author, so a highlight would empty out for visitors
 * after 24h. Highlights outlive the story window because this route reads
 * members with the service role. Writes are validated on ownership alone:
 * the author can read and pick from their own archive, so an expired
 * moment is a legitimate picker source.
 */
import { NextResponse } from "next/server";
import { createBearerClient, createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

const noStore = { "Cache-Control": "no-store, max-age=0" };

const MAX_TITLE_LENGTH = 40;
const MAX_STORIES_PER_HIGHLIGHT = 20;
const CREATE_WINDOW_MS = 10 * 60 * 1000;
const CREATE_LIMIT_PER_WINDOW = 10;

const STORY_SELECT = `
  id, user_id, media_url, media_type, thumbnail_url, duration_seconds,
  interactive_data, text_overlay, visibility, view_count, expires_at,
  created_at,
  profiles!stories_user_id_fkey (id, username, display_name, avatar_url, is_verified)
`;

interface HighlightItemRow {
  sort_order: number;
  stories: { visibility: string } | null;
}

interface HighlightRow {
  id: string;
  user_id: string;
  title: string;
  cover_url: string | null;
  sort_order: number;
  created_at: string;
  story_highlight_items: HighlightItemRow[];
}

async function resolveViewer(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;
  const supabase = bearerToken
    ? createBearerClient(authorization!)
    : await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(bearerToken);
  return user?.id ?? null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { error: "bad_request", detail: "userId" },
      { status: 400, headers: noStore },
    );
  }

  // Highlights and their items are publicly readable by policy; the viewer
  // only matters for the close-friends story filter below.
  const viewerId = await resolveViewer(request);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("story_highlights")
    .select(
      `id, user_id, title, cover_url, sort_order, created_at,
       story_highlight_items ( sort_order, stories (${STORY_SELECT}) )`,
    )
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("highlights fetch failed", error);
    return NextResponse.json(
      { error: "fetch_failed" },
      { status: 500, headers: noStore },
    );
  }

  // Close-friends stories keep their original audience inside a highlight:
  // visible to the owner and to members of the owner's close_friends list.
  let closeFriendsAllowed = viewerId === userId;
  if (!closeFriendsAllowed && viewerId) {
    const { data: cf } = await admin
      .from("close_friends")
      .select("friend_id")
      .eq("user_id", userId)
      .eq("friend_id", viewerId)
      .maybeSingle();
    closeFriendsAllowed = !!cf;
  }

  const highlights = ((data ?? []) as unknown as HighlightRow[])
    .map((h) => {
      const stories = [...h.story_highlight_items]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => item.stories)
        .filter(
          (s) =>
            s !== null &&
            (s.visibility !== "close_friends" || closeFriendsAllowed),
        );
      return {
        id: h.id,
        user_id: h.user_id,
        title: h.title,
        cover_url: h.cover_url,
        created_at: h.created_at,
        stories,
      };
    })
    // Highlights whose every member story was deleted or is hidden from
    // this viewer have nothing to play, so they don't render.
    .filter((h) => h.stories.length > 0);

  return NextResponse.json({ highlights }, { headers: noStore });
}

export async function POST(request: Request) {
  const viewerId = await resolveViewer(request);
  if (!viewerId) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: noStore },
    );
  }

  const { success } = rateLimit(
    `highlights:${viewerId}`,
    CREATE_LIMIT_PER_WINDOW,
    CREATE_WINDOW_MS,
  );
  if (!success) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: noStore },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const storyIds = Array.isArray(body.storyIds)
    ? body.storyIds.filter((id): id is string => typeof id === "string")
    : [];

  if (!title || title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json(
      { error: "validation_failed", detail: "title" },
      { status: 400, headers: noStore },
    );
  }
  if (
    storyIds.length === 0 ||
    storyIds.length > MAX_STORIES_PER_HIGHLIGHT ||
    new Set(storyIds).size !== storyIds.length
  ) {
    return NextResponse.json(
      { error: "validation_failed", detail: "storyIds" },
      { status: 400, headers: noStore },
    );
  }

  const admin = createAdminClient();

  // Every story must belong to the caller. Expiry is deliberately not
  // checked: the archive lets the author pick moments past the 24h window,
  // and the owner filter is the only thing keeping someone else's moment
  // out of a highlight.
  const { data: stories, error: storiesError } = await admin
    .from("stories")
    .select("id, media_url, thumbnail_url")
    .in("id", storyIds)
    .eq("user_id", viewerId);

  if (storiesError) {
    console.error("highlight story check failed", storiesError);
    return NextResponse.json(
      { error: "fetch_failed" },
      { status: 500, headers: noStore },
    );
  }
  if (!stories || stories.length !== storyIds.length) {
    return NextResponse.json(
      { error: "validation_failed", detail: "stories_not_owned" },
      { status: 400, headers: noStore },
    );
  }

  // Cover is the first picked story's media, per the picker contract.
  const byId = new Map(stories.map((s) => [s.id, s]));
  const first = byId.get(storyIds[0])!;
  const coverUrl = first.thumbnail_url ?? first.media_url;

  const { data: highlight, error: insertError } = await admin
    .from("story_highlights")
    .insert({ user_id: viewerId, title, cover_url: coverUrl })
    .select("id, user_id, title, cover_url, created_at")
    .single();

  if (insertError || !highlight) {
    console.error("highlight insert failed", insertError);
    return NextResponse.json(
      { error: "insert_failed" },
      { status: 500, headers: noStore },
    );
  }

  const { error: itemsError } = await admin.from("story_highlight_items").insert(
    storyIds.map((storyId, index) => ({
      highlight_id: highlight.id,
      story_id: storyId,
      sort_order: index,
    })),
  );

  if (itemsError) {
    // Roll back the empty shell so a failed create leaves nothing behind.
    console.error("highlight items insert failed", itemsError);
    await admin.from("story_highlights").delete().eq("id", highlight.id);
    return NextResponse.json(
      { error: "insert_failed" },
      { status: 500, headers: noStore },
    );
  }

  return NextResponse.json({ highlight }, { status: 201, headers: noStore });
}

/**
 * Append the caller's own stories, active or archived, to one of their
 * existing highlights. Same ownership validation as POST; items land after
 * the current members in sort order. The mobile moment camera's "Save to
 * collection" flow and the moment archive both call this.
 */
export async function PATCH(request: Request) {
  const viewerId = await resolveViewer(request);
  if (!viewerId) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: noStore },
    );
  }

  // Shares the create bucket: appends and creates are the same kind of
  // write pressure on the same tables.
  const { success } = rateLimit(
    `highlights:${viewerId}`,
    CREATE_LIMIT_PER_WINDOW,
    CREATE_WINDOW_MS,
  );
  if (!success) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: noStore },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const highlightId =
    typeof body.highlightId === "string" ? body.highlightId : "";
  const storyIds = Array.isArray(body.storyIds)
    ? body.storyIds.filter((id): id is string => typeof id === "string")
    : [];

  if (!highlightId) {
    return NextResponse.json(
      { error: "validation_failed", detail: "highlightId" },
      { status: 400, headers: noStore },
    );
  }
  if (
    storyIds.length === 0 ||
    storyIds.length > MAX_STORIES_PER_HIGHLIGHT ||
    new Set(storyIds).size !== storyIds.length
  ) {
    return NextResponse.json(
      { error: "validation_failed", detail: "storyIds" },
      { status: 400, headers: noStore },
    );
  }

  const admin = createAdminClient();

  const { data: highlight, error: highlightError } = await admin
    .from("story_highlights")
    .select("id, user_id")
    .eq("id", highlightId)
    .eq("user_id", viewerId)
    .maybeSingle();

  if (highlightError) {
    console.error("highlight lookup failed", highlightError);
    return NextResponse.json(
      { error: "fetch_failed" },
      { status: 500, headers: noStore },
    );
  }
  if (!highlight) {
    return NextResponse.json(
      { error: "validation_failed", detail: "highlight_not_owned" },
      { status: 400, headers: noStore },
    );
  }

  const { data: existingItems, error: itemsFetchError } = await admin
    .from("story_highlight_items")
    .select("story_id, sort_order")
    .eq("highlight_id", highlightId);

  if (itemsFetchError) {
    console.error("highlight items fetch failed", itemsFetchError);
    return NextResponse.json(
      { error: "fetch_failed" },
      { status: 500, headers: noStore },
    );
  }

  const memberIds = new Set((existingItems ?? []).map((i) => i.story_id));
  const newIds = storyIds.filter((id) => !memberIds.has(id));
  // Everything requested is already a member; nothing to do.
  if (newIds.length === 0) {
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  if (memberIds.size + newIds.length > MAX_STORIES_PER_HIGHLIGHT) {
    return NextResponse.json(
      { error: "validation_failed", detail: "highlight_full" },
      { status: 400, headers: noStore },
    );
  }

  // Ownership only, same as POST: the archive is a legitimate source.
  const { data: stories, error: storiesError } = await admin
    .from("stories")
    .select("id")
    .in("id", newIds)
    .eq("user_id", viewerId);

  if (storiesError) {
    console.error("highlight story check failed", storiesError);
    return NextResponse.json(
      { error: "fetch_failed" },
      { status: 500, headers: noStore },
    );
  }
  if (!stories || stories.length !== newIds.length) {
    return NextResponse.json(
      { error: "validation_failed", detail: "stories_not_owned" },
      { status: 400, headers: noStore },
    );
  }

  const nextSortOrder =
    (existingItems ?? []).reduce((max, i) => Math.max(max, i.sort_order), -1) +
    1;
  const { error: insertError } = await admin.from("story_highlight_items").insert(
    newIds.map((storyId, index) => ({
      highlight_id: highlightId,
      story_id: storyId,
      sort_order: nextSortOrder + index,
    })),
  );

  if (insertError) {
    console.error("highlight items append failed", insertError);
    return NextResponse.json(
      { error: "insert_failed" },
      { status: 500, headers: noStore },
    );
  }

  return NextResponse.json({ ok: true }, { headers: noStore });
}
