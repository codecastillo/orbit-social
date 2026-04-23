"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileHeader } from "@/components/profile/profile-header";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";

interface ProfileContentProps {
  profile: {
    id: string;
    username: string;
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    cover_url: string | null;
    website: string | null;
    location: string | null;
    is_verified: boolean;
    follower_count: number;
    following_count: number;
    post_count: number;
    created_at: string;
  };
  isOwnProfile: boolean;
  initialIsFollowing: boolean;
}

export function ProfileContent({
  profile,
  isOwnProfile,
  initialIsFollowing,
}: ProfileContentProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const handleFollow = async () => {
    if (!user) {
      toast.error("Sign in to follow users");
      return;
    }

    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    if (wasFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profile.id);

      if (error) {
        setIsFollowing(wasFollowing);
        toast.error("Failed to unfollow");
      }
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: user.id,
        following_id: profile.id,
      });

      if (error) {
        setIsFollowing(wasFollowing);
        toast.error("Failed to follow");
      }
    }
  };

  return (
    <>
      {/* Top bar with back button */}
      <div className="sticky top-0 z-20 flex items-center gap-4 h-12 px-4 bg-background/80 backdrop-blur-xl border-b border-border">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-full hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="font-semibold text-sm leading-tight">
            {profile.display_name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {profile.post_count} posts
          </p>
        </div>
      </div>

      <ProfileHeader
        profile={profile}
        isOwnProfile={isOwnProfile}
        isFollowing={isFollowing}
        onFollow={handleFollow}
      />

      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="w-full rounded-none border-b border-border bg-transparent h-12">
          <TabsTrigger
            value="posts"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Posts
          </TabsTrigger>
          <TabsTrigger
            value="replies"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Replies
          </TabsTrigger>
          <TabsTrigger
            value="media"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Media
          </TabsTrigger>
          <TabsTrigger
            value="likes"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Likes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-0">
          <div className="p-6 text-center text-muted-foreground text-sm">
            No posts yet.
          </div>
        </TabsContent>

        <TabsContent value="replies" className="mt-0">
          <div className="p-6 text-center text-muted-foreground text-sm">
            No replies yet.
          </div>
        </TabsContent>

        <TabsContent value="media" className="mt-0">
          <div className="p-6 text-center text-muted-foreground text-sm">
            No media yet.
          </div>
        </TabsContent>

        <TabsContent value="likes" className="mt-0">
          <div className="p-6 text-center text-muted-foreground text-sm">
            No likes yet.
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
