import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const MEMBER_PROFILE_SELECT = `
  id, username, display_name, avatar_url, bio, is_verified, follower_count
`;

export interface PackMemberProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  follower_count: number;
}

export interface StarterPack {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  members: PackMemberProfile[];
}

interface PackRow {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  starter_pack_members: {
    sort_order: number;
    profiles: PackMemberProfile | null;
  }[];
}

const PACK_SELECT = `
  id, title, description, sort_order, is_active,
  starter_pack_members ( sort_order, profiles ( ${MEMBER_PROFILE_SELECT} ) )
`;

function toPack(row: PackRow): StarterPack {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sort_order: row.sort_order,
    is_active: row.is_active,
    members: (row.starter_pack_members ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => m.profiles)
      .filter((p): p is PackMemberProfile => p !== null),
  };
}

/**
 * Active packs for the onboarding surface. Returns [] on any error so the
 * section simply hides when the tables have not been migrated yet.
 */
export async function getActiveStarterPacks(): Promise<StarterPack[]> {
  const { data, error } = await supabase
    .from("starter_packs")
    .select(PACK_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) return [];
  return ((data ?? []) as unknown as PackRow[]).map(toPack);
}

/**
 * Which of the given members the viewer already follows, so the discover
 * rail can drop packs that have nothing left to offer.
 */
export async function getFollowedMemberIds(
  followerId: string,
  memberIds: string[],
): Promise<Set<string>> {
  if (memberIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", followerId)
    .in("following_id", memberIds);
  if (error) throw error;
  return new Set((data ?? []).map((f) => f.following_id));
}

export interface PackFollowResult {
  /** Members the viewer now actually follows. */
  followed: string[];
  /** Private members who only got a request the owner still has to approve. */
  requested: string[];
}

/**
 * Follows every public pack member the user does not already follow, and files
 * a request for the private ones instead. Skips self-follows and existing rows
 * so it is safe to call repeatedly. Callers report the two buckets separately:
 * a pending request is not a follow.
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

// ── Admin curation ──────────────────────────────────────────────────
// Writes run under the admin's own JWT; RLS on both tables checks
// profiles.is_admin (20260731210000_starter_packs.sql).

export async function getAllStarterPacks(): Promise<StarterPack[]> {
  const { data, error } = await supabase
    .from("starter_packs")
    .select(PACK_SELECT)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as PackRow[]).map(toPack);
}

export async function createStarterPack(input: {
  title: string;
  description?: string | null;
  sort_order?: number;
}) {
  const { data, error } = await supabase
    .from("starter_packs")
    .insert({
      title: input.title,
      description: input.description ?? null,
      sort_order: input.sort_order ?? 0,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function updateStarterPack(
  packId: string,
  updates: {
    title?: string;
    description?: string | null;
    is_active?: boolean;
    sort_order?: number;
  },
) {
  const { error } = await supabase
    .from("starter_packs")
    .update(updates)
    .eq("id", packId);
  if (error) throw error;
}

export async function deleteStarterPack(packId: string) {
  const { error } = await supabase
    .from("starter_packs")
    .delete()
    .eq("id", packId);
  if (error) throw error;
}

export async function addPackMember(
  packId: string,
  userId: string,
  sortOrder: number,
) {
  const { error } = await supabase
    .from("starter_pack_members")
    .insert({ pack_id: packId, user_id: userId, sort_order: sortOrder });
  if (error) throw error;
}

export async function removePackMember(packId: string, userId: string) {
  const { error } = await supabase
    .from("starter_pack_members")
    .delete()
    .eq("pack_id", packId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Persists a full member ordering after an up/down move. */
export async function reorderPackMembers(packId: string, userIds: string[]) {
  await Promise.all(
    userIds.map(async (userId, index) => {
      const { error } = await supabase
        .from("starter_pack_members")
        .update({ sort_order: index })
        .eq("pack_id", packId)
        .eq("user_id", userId);
      if (error) throw error;
    }),
  );
}

/** Persists a full pack ordering after an up/down move. */
export async function reorderStarterPacks(packIds: string[]) {
  await Promise.all(
    packIds.map(async (packId, index) => {
      const { error } = await supabase
        .from("starter_packs")
        .update({ sort_order: index })
        .eq("id", packId);
      if (error) throw error;
    }),
  );
}
