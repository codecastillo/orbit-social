import { supabase } from "@/lib/supabase";

export type JoinPolicy = "public" | "approval" | "invite";

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_private: boolean;
  join_policy: JoinPolicy;
  member_count: number;
  created_by: string;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  content: string | null;
  created_at: string;
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
  is_private, join_policy, member_count, created_by, created_at
`;

export async function getCommunities(limit = 40) {
  const { data, error } = await supabase
    .from("communities")
    .select(COMMUNITY_SELECT)
    .eq("is_private", false)
    .order("member_count", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Community[];
}

export async function getMyCommunities(userId: string) {
  // Strictly rooms the user has joined (community_members row), matching the
  // web app: creating a room does not auto-show it here.
  const { data: memberships, error: memberError } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("user_id", userId);

  if (memberError) throw memberError;
  const memberIds = (memberships ?? []).map((m) => m.community_id);
  if (memberIds.length === 0) return [] as Community[];

  const { data, error } = await supabase
    .from("communities")
    .select(COMMUNITY_SELECT)
    .in("id", memberIds)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Community[];
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

export async function checkMembership(communityId: string, userId: string) {
  const { data, error } = await supabase
    .from("community_members")
    .select("role")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.role as "owner" | "moderator" | "member" | null) ?? null;
}

export async function getMyJoinRequestStatus(communityId: string, userId: string) {
  const { data, error } = await supabase
    .from("community_join_requests")
    .select("status")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.status as "pending" | "approved" | "rejected" | null) ?? null;
}

export async function joinCommunity(communityId: string) {
  // SECURITY DEFINER RPC: routes by community.join_policy. Public rooms join
  // immediately, approval rooms create a pending request, invite rooms refuse.
  const { data, error } = await supabase.rpc("community_join_or_request", {
    p_community_id: communityId,
  });
  if (error) throw error;
  return data as "joined" | "requested" | "invite_only";
}

export async function getCommunityPosts(communityId: string, limit = 30) {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      id, content, created_at,
      profiles!posts_user_id_fkey (
        id, username, display_name, avatar_url, is_verified
      )
    `,
    )
    .eq("community_id", communityId)
    .eq("is_hidden", false)
    .is("reply_to_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as unknown as CommunityPost[];
}
