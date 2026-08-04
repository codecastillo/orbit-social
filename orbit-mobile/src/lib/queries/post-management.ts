import { supabase } from "@/lib/supabase";
import type { WhoCanComment } from "@/lib/queries/posts";

// Own-post management, mirroring the web updatePost/deletePost/pinPost/
// unpinPost in src/lib/queries/posts.ts. Lives apart from posts.ts only
// because that module is under concurrent edit this wave.

export async function updatePost(postId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from("posts")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw error;
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

// Who may reply. RLS limits the update to the author, and a BEFORE INSERT
// trigger on comments is what actually enforces the setting.
export async function updateWhoCanComment(
  postId: string,
  value: WhoCanComment,
): Promise<void> {
  const { error } = await supabase
    .from("posts")
    .update({ who_can_comment: value })
    .eq("id", postId);
  if (error) throw error;
}

// Profile pin, top-level posts only; comments pin through the pin_comment
// RPC in posts.ts instead.
export async function pinPost(postId: string): Promise<void> {
  const { error } = await supabase
    .from("posts")
    .update({ is_pinned: true })
    .eq("id", postId);
  if (error) throw error;
}

export async function unpinPost(postId: string): Promise<void> {
  const { error } = await supabase
    .from("posts")
    .update({ is_pinned: false })
    .eq("id", postId);
  if (error) throw error;
}
