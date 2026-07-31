import { supabase } from "@/lib/supabase";

// Mirrors the web module in src/lib/queries/content-preferences.ts.

export type SensitiveContentLevel = "less" | "standard" | "more";
export type TopicPreference = "see_more" | "see_less";

export interface ContentPreference {
  topic: string;
  preference: TopicPreference;
}

export async function getSensitiveContentLevel(
  userId: string,
): Promise<SensitiveContentLevel> {
  const { data, error } = await supabase
    .from("profiles")
    .select("sensitive_content_level")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return (data?.sensitive_content_level as SensitiveContentLevel) ?? "standard";
}

export async function setSensitiveContentLevel(
  userId: string,
  level: SensitiveContentLevel,
) {
  const { error } = await supabase
    .from("profiles")
    .update({
      sensitive_content_level: level,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw error;
}

export async function getContentPreferences(
  userId: string,
): Promise<ContentPreference[]> {
  const { data, error } = await supabase
    .from("content_preferences")
    .select("topic, preference")
    .eq("user_id", userId)
    .order("topic", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ContentPreference[];
}

/** Topics are keyed lowercase so "Cooking" and "cooking" stay one row. */
export function normalizeTopic(topic: string): string {
  return topic.trim().toLowerCase();
}

export async function setTopicPreference(
  userId: string,
  topic: string,
  preference: TopicPreference,
) {
  const { error } = await supabase.from("content_preferences").upsert({
    user_id: userId,
    topic: normalizeTopic(topic),
    preference,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function removeTopicPreference(userId: string, topic: string) {
  const { error } = await supabase
    .from("content_preferences")
    .delete()
    .eq("user_id", userId)
    .eq("topic", normalizeTopic(topic));

  if (error) throw error;
}
