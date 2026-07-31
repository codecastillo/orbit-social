import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// Reports about the viewer are only visible once actioned (RLS), so this
// row shape is the viewer-facing slice of a report, not the admin one.
export interface Violation {
  id: string;
  reason: string;
  action_taken: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface ContentFlag {
  id: string;
  post_id: string | null;
  reason: string;
  severity: string;
  auto_flagged: boolean;
  reviewed: boolean;
  created_at: string;
}

export interface FiledReport {
  id: string;
  entity_type: string;
  reason: string;
  status: "pending" | "reviewed" | "actioned" | "dismissed";
  created_at: string;
}

export interface Appeal {
  id: string;
  report_id: string;
  message: string;
  status: "pending" | "upheld" | "reversed";
  created_at: string;
}

export async function getViolationHistory(userId: string) {
  const { data, error } = await supabase
    .from("reports")
    .select("id, reason, action_taken, created_at, reviewed_at")
    .eq("reported_user_id", userId)
    .eq("status", "actioned")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Violation[];
}

export async function getContentFlags(userId: string) {
  const { data, error } = await supabase
    .from("content_flags")
    .select("id, post_id, reason, severity, auto_flagged, reviewed, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ContentFlag[];
}

export async function getFiledReports(userId: string) {
  const { data, error } = await supabase
    .from("reports")
    .select("id, entity_type, reason, status, created_at")
    .eq("reporter_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as FiledReport[];
}

export async function getAppeals(userId: string) {
  const { data, error } = await supabase
    .from("report_appeals")
    .select("id, report_id, message, status, created_at")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []) as Appeal[];
}

export async function submitAppeal(
  reportId: string,
  userId: string,
  message: string
) {
  const { data, error } = await supabase
    .from("report_appeals")
    .insert({ report_id: reportId, user_id: userId, message })
    .select("id, report_id, message, status, created_at")
    .single();

  if (error) throw error;
  return data as Appeal;
}
