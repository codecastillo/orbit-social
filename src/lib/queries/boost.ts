import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export async function boostPost(
  postId: string,
  hours: number
): Promise<void> {
  const boostedUntil = new Date(
    Date.now() + hours * 60 * 60 * 1000
  ).toISOString();

  const { error } = await supabase
    .from("posts")
    .update({ boosted_until: boostedUntil })
    .eq("id", postId);

  if (error) throw error;
}

export async function removeBoost(postId: string): Promise<void> {
  const { error } = await supabase
    .from("posts")
    .update({ boosted_until: null })
    .eq("id", postId);

  if (error) throw error;
}

export async function isPostBoosted(postId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("posts")
    .select("boosted_until")
    .eq("id", postId)
    .single();

  if (error) throw error;
  if (!data?.boosted_until) return false;

  return new Date(data.boosted_until) > new Date();
}
