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

  return (
    <div className="border-x border-border min-h-screen">
      <ProfileContent
        profile={profile}
        isOwnProfile={isOwnProfile}
        initialIsFollowing={isFollowing}
      />
    </div>
  );
}
