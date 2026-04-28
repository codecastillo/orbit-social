import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

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
  is_private, join_policy, member_count, created_by, rules, created_at
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

export async function getMyCommunities(userId: string) {
  // Strictly rooms the user has joined (community_members row). Creating a
  // room does NOT auto-show it here — the user has to be a member, just
  // like every other room.
  const { data: memberships } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("user_id", userId);

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

export async function createCommunity(
  _userId: string,
  name: string,
  slug: string,
  description: string,
  joinPolicy: JoinPolicy = "public",
  avatarUrl: string | null = null,
  coverUrl: string | null = null
) {
  const { data, error } = await supabase.rpc("create_community", {
    p_name: name,
    p_slug: slug,
    p_description: description,
    p_join_policy: joinPolicy,
    p_avatar_url: avatarUrl,
    p_cover_url: coverUrl,
  });

  if (error) throw error;
  return data as Community;
}

export async function updateCommunity(
  communityId: string,
  patch: {
    name?: string;
    description?: string;
    avatarUrl?: string | null;
    coverUrl?: string | null;
    clearAvatar?: boolean;
    clearCover?: boolean;
  }
) {
  const { data, error } = await supabase.rpc("update_community", {
    p_community_id: communityId,
    p_name: patch.name ?? null,
    p_description: patch.description ?? null,
    p_avatar_url: patch.avatarUrl ?? null,
    p_cover_url: patch.coverUrl ?? null,
    p_clear_avatar: patch.clearAvatar ?? false,
    p_clear_cover: patch.clearCover ?? false,
  });
  if (error) throw error;
  return data as Community;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function uploadCommunityImage(
  userId: string,
  communityId: string,
  kind: "avatar" | "cover",
  file: File
): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("File must be JPEG, PNG, WebP, or GIF");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be under 5MB");
  }
  const bucket = kind === "avatar" ? "avatars" : "covers";
  const ext = file.name.split(".").pop() || "png";
  // First path segment must be the user's id — matches the existing storage
  // RLS that gates avatars/covers writes by uid folder.
  const path = `${userId}/communities/${communityId}/${kind}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function joinCommunity(communityId: string) {
  // SECURITY DEFINER RPC: routes by community.join_policy.
  // Returns 'joined' | 'requested' | 'invite_only'.
  const { data, error } = await supabase.rpc("community_join_or_request", {
    p_community_id: communityId,
  });
  if (error) throw error;
  return data as "joined" | "requested" | "invite_only";
}

export interface CommunityJoinRequest {
  id: string;
  community_id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  decided_at: string | null;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

export async function getCommunityJoinRequests(communityId: string) {
  const { data, error } = await supabase
    .from("community_join_requests")
    .select(
      `
      id, community_id, user_id, status, created_at, decided_at,
      profiles!community_join_requests_user_id_fkey (
        id, username, display_name, avatar_url, is_verified
      )
    `
    )
    .eq("community_id", communityId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as unknown as CommunityJoinRequest[];
}

export async function approveCommunityRequest(requestId: string) {
  const { error } = await supabase.rpc("community_approve_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function rejectCommunityRequest(requestId: string) {
  const { error } = await supabase.rpc("community_reject_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function inviteCommunityUser(communityId: string, userId: string) {
  const { error } = await supabase.rpc("community_invite_user", {
    p_community_id: communityId,
    p_user_id: userId,
  });
  if (error) throw error;
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

export async function deleteCommunity(communityId: string) {
  // SECURITY DEFINER RPC: re-checks ownership server-side and bypasses the
  // RLS-silent-filter problem (a plain DELETE under RLS returns no error
  // when 0 rows are affected, so we couldn't tell success from a missing
  // policy match).
  const { error } = await supabase.rpc("delete_community", {
    p_community_id: communityId,
  });
  if (error) throw error;
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
