"use client";

import { useState } from "react";
import { ArrowLeft, Grid3X3, Heart, Repeat2, Bookmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileGrid } from "@/components/profile/profile-grid";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { getUserPosts } from "@/lib/queries/posts";
import { cn } from "@/lib/utils";

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

const tabs = [
  { value: "posts", icon: Grid3X3, label: "Posts" },
  { value: "likes", icon: Heart, label: "Likes" },
  { value: "reposts", icon: Repeat2, label: "Reposts" },
  { value: "saved", icon: Bookmark, label: "Saved" },
] as const;

type TabValue = (typeof tabs)[number]["value"];

export function ProfileContent({
  profile,
  isOwnProfile,
  initialIsFollowing,
}: ProfileContentProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [activeTab, setActiveTab] = useState<TabValue>("posts");
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const { data: posts = [] } = useQuery({
    queryKey: ["user-posts", profile.id],
    queryFn: () => getUserPosts(profile.id),
    staleTime: 1000 * 60 * 2,
  });

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
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center gap-4 h-14 px-4 bg-background/80 backdrop-blur-xl border-b border-white/[0.06]">
        <button
          onClick={() => router.back()}
          className="h-9 w-9 flex items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/[0.08] transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2
            className="font-bold text-base leading-tight"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
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

      {/* Tab bar — Posts, Likes, Reposts, Saved */}
      <div className="flex border-t border-white/[0.06]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          // Only show Saved tab on own profile
          if (tab.value === "saved" && !isOwnProfile) return null;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-3 relative transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/70"
              )}
              aria-label={tab.label}
            >
              <Icon className="h-4.5 w-4.5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <span className="absolute top-0 inset-x-0 h-[2px] bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "posts" && <ProfileGrid posts={posts} />}

      {activeTab === "likes" && (
        <div className="p-12 text-center text-muted-foreground text-sm">
          <Heart className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No liked posts yet</p>
          <p className="text-xs mt-1 opacity-60">Posts you like will appear here.</p>
        </div>
      )}

      {activeTab === "reposts" && (
        <div className="p-12 text-center text-muted-foreground text-sm">
          <Repeat2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No reposts yet</p>
          <p className="text-xs mt-1 opacity-60">Posts you repost will appear here.</p>
        </div>
      )}

      {activeTab === "saved" && isOwnProfile && (
        <div className="p-12 text-center text-muted-foreground text-sm">
          <Bookmark className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No saved posts yet</p>
          <p className="text-xs mt-1 opacity-60">Tap the bookmark icon to save posts here.</p>
        </div>
      )}
    </>
  );
}
