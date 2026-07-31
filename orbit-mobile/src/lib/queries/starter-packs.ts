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

/**
 * Follows every listed member the user does not already follow. Skips
 * self-follows and existing rows so repeat taps are safe.
 */
export async function followPackMembers(
  followerId: string,
  memberIds: string[],
): Promise<number> {
  const targets = memberIds.filter((id) => id !== followerId);
  if (targets.length === 0) return 0;

  const { data: existing, error: readError } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", followerId)
    .in("following_id", targets);
  if (readError) throw readError;

  const already = new Set((existing ?? []).map((f) => f.following_id));
  const inserts = targets
    .filter((id) => !already.has(id))
    .map((id) => ({ follower_id: followerId, following_id: id }));
  if (inserts.length === 0) return 0;

  const { error } = await supabase.from("follows").insert(inserts);
  if (error) throw error;
  return inserts.length;
}
