import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";

const supabase = createClient();

export interface ReportWithProfiles {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  entity_type: string;
  entity_id: string;
  reason: string;
  description: string | null;
  status: "pending" | "reviewed" | "actioned" | "dismissed";
  reviewed_by: string | null;
  reviewed_at: string | null;
  action_taken: string | null;
  created_at: string;
  reporter: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  reported_user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export interface AdminUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  is_admin: boolean;
  is_private: boolean;
  bio: string | null;
  created_at: string;
  post_count: number;
  follower_count: number;
}

export interface AdminStats {
  totalUsers: number;
  totalPosts: number;
  pendingReports: number;
  newUsersToday: number;
}

const REPORT_SELECT = `
  *,
  reporter:profiles!reports_reporter_id_fkey (
    id, username, display_name, avatar_url
  ),
  reported_user:profiles!reports_reported_user_id_fkey (
    id, username, display_name, avatar_url
  )
`;

export async function getReports(
  status?: string,
  cursor?: string,
  limit = 20
) {
  let query = supabase
    .from("reports")
    .select(REPORT_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as ReportWithProfiles[];
}

export async function getReportById(reportId: string) {
  const { data, error } = await supabase
    .from("reports")
    .select(REPORT_SELECT)
    .eq("id", reportId)
    .single();

  if (error) throw error;
  return data as unknown as ReportWithProfiles;
}

export async function updateReportStatus(
  reportId: string,
  status: "pending" | "reviewed" | "actioned" | "dismissed",
  reviewerId: string,
  actionTaken?: string
) {
  const { data, error } = await supabase
    .from("reports")
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      action_taken: actionTaken || null,
    })
    .eq("id", reportId)
    .select(REPORT_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as ReportWithProfiles;
}

export async function getAdminStats(): Promise<AdminStats> {
  const adminClient = createAdminClient();

  const [usersResult, postsResult, reportsResult, newUsersResult] =
    await Promise.all([
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true }),
      adminClient
        .from("posts")
        .select("id", { count: "exact", head: true }),
      adminClient
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte(
          "created_at",
          new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        ),
    ]);

  return {
    totalUsers: usersResult.count ?? 0,
    totalPosts: postsResult.count ?? 0,
    pendingReports: reportsResult.count ?? 0,
    newUsersToday: newUsersResult.count ?? 0,
  };
}

export async function getUsers(
  query?: string,
  cursor?: string,
  limit = 20
) {
  let q = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (query) {
    q = q.or(
      `username.ilike.%${query}%,display_name.ilike.%${query}%`
    );
  }

  if (cursor) {
    q = q.lt("created_at", cursor);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as AdminUser[];
}

export async function toggleUserAdmin(userId: string, isAdmin: boolean) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("profiles")
    .update({ is_admin: isAdmin })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function suspendUser(userId: string) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("profiles")
    .update({ is_private: true })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createReport(
  reporterId: string,
  entityType: string,
  entityId: string,
  reason: string,
  description?: string,
  reportedUserId?: string
) {
  const { data, error } = await supabase
    .from("reports")
    .insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId || null,
      entity_type: entityType,
      entity_id: entityId,
      reason,
      description: description || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
