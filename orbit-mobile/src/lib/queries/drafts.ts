import { supabase } from "@/lib/supabase";

// Mirrors the web DraftData in src/lib/queries/drafts.ts (mobile cannot
// import web code): the composer settings a draft carries besides its
// text. Media is deliberately absent, since uploading unpublished
// attachments would cost storage for posts that may never exist.
export interface DraftData {
  location?: string;
  visibility?: "public" | "close_friends";
  contentWarning?: string;
  poll?: { options: string[]; endHours: number };
  scheduledAt?: string;
}

export interface PostDraft {
  id: string;
  content: string;
  draft_data: DraftData;
  created_at: string;
  updated_at: string;
}

const DRAFT_SELECT = "id, content, draft_data, created_at, updated_at";

export async function listDrafts(userId: string): Promise<PostDraft[]> {
  const { data, error } = await supabase
    .from("post_drafts")
    .select(DRAFT_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PostDraft[];
}

export async function createDraft(
  userId: string,
  content: string,
  draftData: DraftData = {},
): Promise<PostDraft> {
  const { data, error } = await supabase
    .from("post_drafts")
    .insert({ user_id: userId, content, draft_data: draftData })
    .select(DRAFT_SELECT)
    .single();
  if (error) throw error;
  return data as PostDraft;
}

export async function updateDraft(
  draftId: string,
  content: string,
  draftData: DraftData = {},
): Promise<void> {
  const { error } = await supabase
    .from("post_drafts")
    .update({
      content,
      draft_data: draftData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId);
  if (error) throw error;
}

export async function deleteDraft(draftId: string): Promise<void> {
  const { error } = await supabase
    .from("post_drafts")
    .delete()
    .eq("id", draftId);
  if (error) throw error;
}
