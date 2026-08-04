import { supabase } from "@/lib/supabase";

export interface PackMemberProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  follower_count: number;
}

export interface StarterPack {
  id: string;
  title: string;
  description: string | null;
  members: PackMemberProfile[];
}

interface PackRow {
  id: string;
  title: string;
  description: string | null;
  starter_pack_members: {
    sort_order: number;
    profiles: PackMemberProfile | null;
  }[];
}

/**
 * Active curated packs for the post-onboarding screen. Returns [] on any
 * error so the packs step simply never shows when the tables have not been
 * migrated yet.
 */
export async function getActiveStarterPacks(): Promise<StarterPack[]> {
  const { data, error } = await supabase
    .from("starter_packs")
    .select(
      `id, title, description,
       starter_pack_members (
         sort_order,
         profiles ( id, username, display_name, avatar_url, is_verified, follower_count )
       )`,
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) return [];
  return ((data ?? []) as unknown as PackRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    members: (row.starter_pack_members ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => m.profiles)
      .filter((p): p is PackMemberProfile => p !== null),
  }));
}

export interface PackFollowResult {
  /** Members the viewer now actually follows. */
  followed: string[];
  /** Private members who only got a request the owner still has to approve. */
  requested: string[];
}

/**
 * Follows every public member the user does not already follow, and files a
 * request for the private ones instead. Skips self-follows and existing rows
 * so repeat taps are safe. Callers report the two buckets separately: a
 * pending request is not a follow.
 */
export async function followPackMembers(
  followerId: string,
  memberIds: string[],
): Promise<PackFollowResult> {
  const empty: PackFollowResult = { followed: [], requested: [] };
  const targets = memberIds.filter((id) => id !== followerId);
  if (targets.length === 0) return empty;

  const [existingRes, profilesRes] = await Promise.all([
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", followerId)
      .in("following_id", targets),
    supabase.from("profiles").select("id, is_private").in("id", targets),
  ]);
  if (existingRes.error) throw existingRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const already = new Set((existingRes.data ?? []).map((f) => f.following_id));
  const isPrivate = new Set(
    (profilesRes.data ?? [])
      .filter((p) => p.is_private === true)
      .map((p) => p.id),
  );

  const pending = targets.filter((id) => !already.has(id));
  const followed = pending.filter((id) => !isPrivate.has(id));
  const requested = pending.filter((id) => isPrivate.has(id));

  if (followed.length > 0) {
    const { error } = await supabase
      .from("follows")
      .insert(
        followed.map((id) => ({ follower_id: followerId, following_id: id })),
      );
    if (error) throw error;
  }

  if (requested.length > 0) {
    // ignoreDuplicates so re-running a pack over an already pending request
    // is a no-op rather than a primary-key error.
    const { error } = await supabase
      .from("follow_requests")
      .upsert(
        requested.map((id) => ({ requester_id: followerId, target_id: id })),
        { onConflict: "requester_id,target_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  }

  return { followed, requested };
}
