import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// Composer state a draft carries besides its text. Media is deliberately
// absent: uploading unpublished attachments would cost storage for posts
// that may never exist, so drafts keep text and settings only. The mobile
// app reads and writes the same shape (orbit-mobile/src/lib/queries/drafts.ts).
export interface DraftData {
  location?: string;
  visibility?: "public" | "close_friends";
  contentWarning?: string;
  poll?: { options: string[]; endHours: number };
  // datetime-local string as typed in the composer, so it round-trips
  // exactly into the schedule input.
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
  draftData: DraftData
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
  draftData: DraftData
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

// Drafts used to live on-device under this key. The first composer or
// drafts-page visit after sign-in silently imports them and clears it,
// the same flow the muted-words migration uses.
const LEGACY_STORAGE_KEY = "orbit_drafts";

interface LegacyDraft {
  id: string;
  content: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

let migrationAttempted = false;

/**
 * One-time import of legacy localStorage drafts. Resolves true when rows
 * were imported (callers should refetch). On failure the key is kept and
 * the guard resets so a later visit retries.
 */
export async function migrateLocalDrafts(userId: string): Promise<boolean> {
  if (migrationAttempted || typeof window === "undefined") return false;
  migrationAttempted = true;

  let raw: string | null = null;
  let parsed: unknown = [];
  try {
    raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) parsed = JSON.parse(raw);
  } catch {
    // Unreadable legacy data; nothing worth migrating.
  }
  if (!raw) return false;

  // Legacy media was blob previews that die on reload, so only text and
  // location survive the move. Empty drafts have nothing to keep.
  const rows = (Array.isArray(parsed) ? (parsed as LegacyDraft[]) : [])
    .filter((d) => d && (d.content?.trim() || d.location))
    .map((d) => ({
      // Reuse the legacy uuid as the primary key so a retried import
      // upserts instead of duplicating.
      id: d.id,
      user_id: userId,
      content: d.content ?? "",
      draft_data: (d.location ? { location: d.location } : {}) as DraftData,
      created_at: d.createdAt,
      updated_at: d.updatedAt || d.createdAt,
    }));

  if (rows.length === 0) {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return false;
  }

  try {
    const { error } = await supabase
      .from("post_drafts")
      .upsert(rows, { onConflict: "id" });
    if (error) throw error;
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return true;
  } catch {
    // Keep the key so the import retries on the next visit.
    migrationAttempted = false;
    return false;
  }
}
