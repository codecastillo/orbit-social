import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface CreatorStats {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalViews: number;
  followerCount: number;
}

export interface PostPerformance {
  id: string;
  content: string | null;
  like_count: number;
  comment_count: number;
  repost_count: number;
  view_count: number;
  engagement: number;
  created_at: string;
}

export interface FollowerGrowthDay {
  date: string;
  count: number;
}

export async function getCreatorStats(userId: string): Promise<CreatorStats> {
  // Get profile stats (follower_count, post_count)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("follower_count, post_count")
    .eq("id", userId)
    .single();

  if (profileError) throw profileError;

  // Get aggregated post stats
  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("like_count, comment_count, view_count")
    .eq("user_id", userId);

  if (postsError) throw postsError;

  const totalLikes = posts?.reduce((sum, p) => sum + (p.like_count || 0), 0) ?? 0;
  const totalComments = posts?.reduce((sum, p) => sum + (p.comment_count || 0), 0) ?? 0;
  const totalViews = posts?.reduce((sum, p) => sum + (p.view_count || 0), 0) ?? 0;

  return {
    totalPosts: profile?.post_count ?? 0,
    totalLikes,
    totalComments,
    totalViews,
    followerCount: profile?.follower_count ?? 0,
  };
}

export async function getPostPerformance(
  userId: string,
  limit: number = 10
): Promise<PostPerformance[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, content, like_count, comment_count, repost_count, view_count, created_at")
    .eq("user_id", userId)
    .order("like_count", { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Sort by total engagement (likes + comments + reposts)
  const sorted = (data ?? [])
    .map((post) => ({
      ...post,
      engagement:
        (post.like_count || 0) +
        (post.comment_count || 0) +
        (post.repost_count || 0),
    }))
    .sort((a, b) => b.engagement - a.engagement);

  return sorted;
}

export async function getFollowerGrowth(
  userId: string
): Promise<FollowerGrowthDay[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from("follows")
    .select("created_at")
    .eq("following_id", userId)
    .gte("created_at", thirtyDaysAgo.toISOString());

  if (error) throw error;

  // Group by date
  const grouped: Record<string, number> = {};

  // Initialize all 30 days with 0
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    grouped[key] = 0;
  }

  // Count followers per day
  (data ?? []).forEach((follow) => {
    const key = new Date(follow.created_at).toISOString().split("T")[0];
    if (grouped[key] !== undefined) {
      grouped[key]++;
    }
  });

  return Object.entries(grouped).map(([date, count]) => ({ date, count }));
}
