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

  const pillBase =
    "rounded-full px-5 py-2 text-[13px] font-semibold transition-all border-0 bg-white/[0.05] text-muted-foreground hover:bg-white/[0.08] data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:shadow-primary/10";

  return (
    <>
      {/* Top bar — frosted glass sticky header */}
      <div className="sticky top-0 z-20 flex items-center gap-4 h-14 px-4 bg-background/60 backdrop-blur-2xl border-b border-white/[0.06]">
        {/* Back button — frosted glass circle */}
        <button
          onClick={() => router.back()}
          className="h-9 w-9 flex items-center justify-center rounded-full bg-white/[0.05] backdrop-blur-xl hover:bg-white/[0.10] transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="font-bold text-base leading-tight">
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

      {/* Tabs — pill-style chips */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="w-full justify-start gap-2 rounded-none border-b border-white/[0.06] bg-transparent h-auto px-5 py-3">
          <TabsTrigger value="posts" className={pillBase}>
            Posts
          </TabsTrigger>
          <TabsTrigger value="replies" className={pillBase}>
            Replies
          </TabsTrigger>
          <TabsTrigger value="clips" className={pillBase}>
            Clips
          </TabsTrigger>
          <TabsTrigger value="likes" className={pillBase}>
            Likes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-0">
          <div className="p-8 text-center text-muted-foreground text-sm">
            No posts yet.
          </div>
        </TabsContent>

        <TabsContent value="replies" className="mt-0">
          <div className="p-8 text-center text-muted-foreground text-sm">
            No replies yet.
          </div>
        </TabsContent>

        <TabsContent value="clips" className="mt-0">
          <div className="p-8 text-center text-muted-foreground text-sm">
            No clips yet.
          </div>
        </TabsContent>

        <TabsContent value="likes" className="mt-0">
          <div className="p-8 text-center text-muted-foreground text-sm">
            No likes yet.
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
