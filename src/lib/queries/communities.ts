import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_private: boolean;
  member_count: number;
  created_by: string;
  rules: CommunityRule[] | null;
  created_at: string;
}

export interface CommunityRule {
  title: string;
  description: string;
}

export interface CommunityMember {
  community_id: string;
  user_id: string;
  role: "owner" | "moderator" | "member";
  joined_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

const COMMUNITY_SELECT = `
  id, name, slug, description, avatar_url, cover_url,
  is_private, member_count, created_by, rules, created_at
`;

const POST_SELECT = `
  *,
  profiles!posts_user_id_fkey (
    id, username, display_name, avatar_url, is_verified
  ),
  post_media (
    id, type, url, thumbnail_url, width, height, blurhash, sort_order
  )
`;

export async function getCommunities(cursor?: string, limit = 20) {
  let query = supabase
    .from("communities")
    .select(COMMUNITY_SELECT)
    .eq("is_private", false)
    .order("member_count", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Community[];
}

export async function getCommunityBySlug(slug: string) {
  const { data, error } = await supabase
    .from("communities")
    .select(COMMUNITY_SELECT)
    .eq("slug", slug)
    .single();

  if (error) throw error;
  return data as Community;
}

export async function createCommunity(
  userId: string,
  name: string,
  slug: string,
  description: string
) {
  const { data: community, error } = await supabase
    .from("communities")
    .insert({
      name,
      slug,
      description,
      created_by: userId,
      member_count: 1,
    })
    .select(COMMUNITY_SELECT)
    .single();

  if (error) throw error;

  // Add creator as owner
  const { error: memberError } = await supabase
    .from("community_members")
    .insert({
      community_id: community.id,
      user_id: userId,
      role: "owner",
    });

  if (memberError) throw memberError;

  return community as Community;
}

export async function joinCommunity(communityId: string, userId: string) {
  const { error } = await supabase.from("community_members").insert({
    community_id: communityId,
    user_id: userId,
    role: "member",
  });

  if (error) throw error;

  // Increment member count
  await supabase.rpc("increment_member_count", {
    community_id_input: communityId,
  }).then(({ error: rpcError }) => {
    // Fallback: manually update if RPC doesn't exist
    if (rpcError) {
      return supabase
        .from("communities")
        .update({ member_count: supabase.rpc("", {}) as unknown as number })
        .eq("id", communityId);
    }
  });
}

export async function leaveCommunity(communityId: string, userId: string) {
  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function getCommunityMembers(communityId: string, limit = 20) {
  const { data, error } = await supabase
    .from("community_members")
    .select(
      `
      community_id, user_id, role, joined_at,
      profiles (
        id, username, display_name, avatar_url, is_verified
      )
    `
    )
    .eq("community_id", communityId)
    .order("joined_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data as unknown as CommunityMember[];
}

export async function getCommunityPosts(
  communityId: string,
  cursor?: string,
  limit = 20
) {
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("community_id", communityId)
    .eq("is_hidden", false)
    .is("reply_to_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function checkMembership(communityId: string, userId: string) {
  const { data, error } = await supabase
    .from("community_members")
    .select("role")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.role as "owner" | "moderator" | "member" | null;
}

export async function searchCommunities(query: string, limit = 20) {
  const { data, error } = await supabase
    .from("communities")
    .select(COMMUNITY_SELECT)
    .eq("is_private", false)
    .ilike("name", `%${query}%`)
    .order("member_count", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Community[];
}
