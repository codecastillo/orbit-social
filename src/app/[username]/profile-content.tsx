"use client";

import { useState } from "react";
import { ArrowLeft, Grid3X3, LayoutList, Bookmark } from "lucide-react";
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
  { value: "grid", icon: Grid3X3, label: "Posts" },
  { value: "list", icon: LayoutList, label: "List" },
  { value: "saved", icon: Bookmark, label: "Saved" },
] as const;

type TabValue = (typeof tabs)[number]["value"];

export function ProfileContent({
  profile,
  isOwnProfile,
  initialIsFollowing,
}: ProfileContentProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [activeTab, setActiveTab] = useState<TabValue>("grid");
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
      <div className="sticky top-0 z-20 flex items-center gap-4 h-14 px-4 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <button
          onClick={() => router.back()}
          className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted/50 transition-colors"
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

      {/* Instagram-style icon tab bar */}
      <div className="flex border-t border-border/40">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex-1 flex items-center justify-center py-3 relative transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/70"
              )}
              aria-label={tab.label}
            >
              <Icon className="h-5 w-5" />
              {isActive && (
                <span className="absolute top-0 inset-x-0 h-[1px] bg-foreground" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "grid" && <ProfileGrid posts={posts} />}

      {activeTab === "list" && (
        <div className="p-8 text-center text-muted-foreground text-sm">
          No list posts yet.
        </div>
      )}

      {activeTab === "saved" && (
        <div className="p-8 text-center text-muted-foreground text-sm">
          No saved posts yet.
        </div>
      )}
    </>
  );
}
