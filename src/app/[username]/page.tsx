import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileContent } from "./profile-content";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, bio")
    .eq("username", username)
    .single();

  if (!profile) return { title: "User not found" };

  return {
    title: profile.display_name,
    description: profile.bio || `@${username} on Orbit`,
  };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwnProfile = user?.id === profile.id;

  let isFollowing = false;
  if (user && !isOwnProfile) {
    const { data: follow } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", profile.id)
      .single();

    isFollowing = !!follow;
  }

  // Pre-compute the tab visibility counts server-side so the tab strip
  // doesn't flash from "all on" → "real shape" once the client query
  // resolves. Cheap head-only counts, all hit indexed columns.
  const includeSaved = !!user && user.id === profile.id;
  const [
    postsRes,
    clipsRes,
    repostsRes,
    taggedRes,
    likesRes,
    savedRes,
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .is("reply_to_id", null)
      .is("community_id", null)
      .eq("is_hidden", false)
      .not("type", "in", "(reel,repost)"),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("type", "reel")
      .is("community_id", null)
      .eq("is_hidden", false),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("type", "repost")
      .is("community_id", null)
      .eq("is_hidden", false),
    supabase
      .from("post_mentions")
      .select("post_id", { count: "exact", head: true })
      .eq("user_id", profile.id),
    supabase
      .from("post_likes")
      .select("post_id", { count: "exact", head: true })
      .eq("user_id", profile.id),
    includeSaved
      ? supabase
          .from("bookmarks")
          .select("post_id", { count: "exact", head: true })
          .eq("user_id", profile.id)
      : Promise.resolve({ count: 0 } as { count: number | null }),
  ]);

  const initialTabCounts = {
    posts: postsRes.count ?? 0,
    clips: clipsRes.count ?? 0,
    reposts: repostsRes.count ?? 0,
    tagged: taggedRes.count ?? 0,
    likes: likesRes.count ?? 0,
    saved: savedRes.count ?? 0,
  };

  return (
    <div className="min-h-screen">
      <ProfileContent
        profile={profile}
        isOwnProfile={isOwnProfile}
        initialIsFollowing={isFollowing}
        initialTabCounts={initialTabCounts}
      />
    </div>
  );
}
