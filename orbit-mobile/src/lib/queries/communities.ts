import { supabase } from "@/lib/supabase";
import { POST_SELECT, type Post } from "@/lib/queries/posts";

export type JoinPolicy = "public" | "approval" | "invite";

export type CommunityRole = "owner" | "moderator" | "member";

export interface CommunityRule {
  title: string;
  description: string;
}

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
  slowmode_seconds: number;
  created_at: string;
}

export interface CommunityMember {
  community_id: string;
  user_id: string;
  role: CommunityRole;
  joined_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

export interface CommunityJoinRequest {
  id: string;
  community_id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
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
  is_private, join_policy, member_count, created_by, rules,
  slowmode_seconds, created_at
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

export async function createCommunity(
  name: string,
  slug: string,
  description: string,
  joinPolicy: JoinPolicy,
) {
  // Same SECURITY DEFINER RPC the web create dialog calls; images are
  // uploaded after create (the storage path needs the community id) and
  // patched in via update_community.
  const { data, error } = await supabase.rpc("create_community", {
    p_name: name,
    p_slug: slug,
    p_description: description,
    p_join_policy: joinPolicy,
    p_avatar_url: null,
    p_cover_url: null,
  });

  if (error) throw error;
  return data as Community;
}

export async function updateCommunity(
  communityId: string,
  patch: { avatarUrl?: string | null; coverUrl?: string | null },
) {
  const { data, error } = await supabase.rpc("update_community", {
    p_community_id: communityId,
    p_name: null,
    p_description: null,
    p_avatar_url: patch.avatarUrl ?? null,
    p_cover_url: patch.coverUrl ?? null,
    p_clear_avatar: false,
    p_clear_cover: false,
  });
  if (error) throw error;
  return data as Community;
}

export async function uploadCommunityImage(
  userId: string,
  communityId: string,
  kind: "avatar" | "cover",
  uri: string,
  mimeType: string,
): Promise<string> {
  // First path segment must be the user's id: the avatars/covers storage
  // RLS gates writes by uid folder (same convention as the web app).
  const bucket = kind === "avatar" ? "avatars" : "covers";
  const ext = mimeType.split("/")[1] ?? "jpg";
  const path = `${userId}/communities/${communityId}/${kind}.${ext}`;

  const response = await fetch(uri);
  const body = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType: mimeType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  // Cache-bust: the path is stable across replacements.
  return `${data.publicUrl}?t=${Date.now()}`;
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
    // The same columns the feed selects: a room post is a post, and the room
    // renders it with the same card rather than a stripped-down row.
    .select(POST_SELECT)
    .eq("community_id", communityId)
    .eq("is_hidden", false)
    .is("reply_to_id", null)
    // Pinned room posts surface first, same ordering as the web room feed.
    .order("is_pinned", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as unknown as Post[];
}

export async function setCommunityPostPinned(postId: string, pinned: boolean) {
  // SECURITY DEFINER RPC: the room's owner and moderators can pin any
  // top-level room post, and the author self-pins through the same path.
  const { error } = await supabase.rpc("pin_community_post", {
    p_post_id: postId,
    p_pinned: pinned,
  });
  if (error) throw error;
}

export async function setCommunitySlowmode(communityId: string, seconds: number) {
  // Direct update: the communities UPDATE policy is creator-only
  // (auth.uid() = created_by) and update_community has no slowmode param, so
  // only the room creator can change this. A moderator's update would
  // silently match zero rows, which is why the setting UI is owner-only
  // even though enforcement exempts moderators too.
  const { error } = await supabase
    .from("communities")
    .update({ slowmode_seconds: seconds })
    .eq("id", communityId);
  if (error) throw error;
}

export async function getCommunityMembers(communityId: string, limit = 200) {
  const { data, error } = await supabase
    .from("community_members")
    .select(
      `
      community_id, user_id, role, joined_at,
      profiles (
        id, username, display_name, avatar_url, is_verified
      )
    `,
    )
    .eq("community_id", communityId)
    .order("joined_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data as unknown as CommunityMember[];
}

export async function getCommunityJoinRequests(communityId: string) {
  const { data, error } = await supabase
    .from("community_join_requests")
    .select(
      `
      id, community_id, user_id, status, created_at,
      profiles!community_join_requests_user_id_fkey (
        id, username, display_name, avatar_url, is_verified
      )
    `,
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

/**
 * Leave a room. A plain delete rather than the remove-member RPC, which is
 * owner-only: the DELETE policy on community_members already allows a member
 * to remove their own row.
 */
export async function leaveCommunity(communityId: string, userId: string) {
  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeCommunityMember(communityId: string, userId: string) {
  // SECURITY DEFINER RPC, owner-only server-side.
  const { error } = await supabase.rpc("community_remove_member", {
    p_community_id: communityId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function setCommunityMemberRole(
  communityId: string,
  userId: string,
  role: "moderator" | "member",
) {
  // SECURITY DEFINER RPC, owner-only server-side.
  const { error } = await supabase.rpc("community_set_member_role", {
    p_community_id: communityId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function inviteCommunityUser(communityId: string, userId: string) {
  // SECURITY DEFINER RPC, owner/moderator only. Adds the user directly as a
  // member; no notification row is created server-side.
  const { error } = await supabase.rpc("community_invite_user", {
    p_community_id: communityId,
    p_user_id: userId,
  });
  if (error) throw error;
}
