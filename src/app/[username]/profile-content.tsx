"use client";

import { useState } from "react";
import { ArrowLeft, Grid3X3, Heart, Repeat2, Bookmark, Pin } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileGrid } from "@/components/profile/profile-grid";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { getUserPosts, getUserLikedPosts, getUserBookmarkedPosts, getUserRepostedPosts, getUserPinnedPosts } from "@/lib/queries/posts";
import { PostCard } from "@/components/feed/post-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const syne = { fontFamily: "var(--font-syne), sans-serif" };

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
    theme_color?: string | null;
    avatar_border?: string | null;
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

  const { data: pinnedPosts = [] } = useQuery({
    queryKey: ["user-pinned-posts", profile.id],
    queryFn: () => getUserPinnedPosts(profile.id),
    staleTime: 1000 * 60 * 2,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["user-posts", profile.id],
    queryFn: () => getUserPosts(profile.id),
    staleTime: 1000 * 60 * 2,
  });

  const { data: likedPosts = [], isLoading: isLoadingLikes } = useQuery({
    queryKey: ["user-liked-posts", profile.id],
    queryFn: () => getUserLikedPosts(profile.id),
    enabled: activeTab === "likes",
    staleTime: 1000 * 60,
  });

  const { data: repostedPosts = [], isLoading: isLoadingReposts } = useQuery({
    queryKey: ["user-reposted-posts", profile.id],
    queryFn: () => getUserRepostedPosts(profile.id),
    enabled: activeTab === "reposts",
    staleTime: 1000 * 60,
  });

  const { data: savedPosts = [], isLoading: isLoadingSaved } = useQuery({
    queryKey: ["user-saved-posts", profile.id],
    queryFn: () => getUserBookmarkedPosts(profile.id),
    enabled: activeTab === "saved" && isOwnProfile,
    staleTime: 1000 * 60,
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
      <div className="sticky top-0 z-20 flex items-center gap-4 h-14 px-5 bg-background/80 backdrop-blur-2xl shadow-[0_1px_0_oklch(1_0_0_/_0.06)]">
        <button
          onClick={() => router.back()}
          className="h-9 w-9 flex items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/[0.08] transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2
            className="font-extrabold text-base leading-tight"
            style={syne}
          >
            {profile.display_name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {profile.post_count} posts
          </p>
        </div>
      </div>

      {/* Gradient accent behind header */}
      <div className="relative">
        <ProfileHeader
          profile={profile}
          isOwnProfile={isOwnProfile}
          isFollowing={isFollowing}
          onFollow={handleFollow}
        />
      </div>

      {/* Tab bar */}
      <div className="flex shadow-[0_1px_0_oklch(1_0_0_/_0.06)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          if (tab.value === "saved" && !isOwnProfile) return null;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-12 relative transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/70"
              )}
              aria-label={tab.label}
            >
              <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
              <span className="text-[12px] font-semibold">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-0 inset-x-4 h-[3px] bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {/* Pinned posts section */}
      {activeTab === "posts" && pinnedPosts.length > 0 && (
        <div className="border-b border-white/[0.06]">
          {pinnedPosts.map((post) => (
            <div key={post.id} className="relative">
              <div className="flex items-center gap-1.5 px-4 pt-3 text-[11px] text-muted-foreground font-medium">
                <Pin className="h-3 w-3" />
                <span>Pinned</span>
              </div>
              <PostCard post={post} />
            </div>
          ))}
        </div>
      )}

      {activeTab === "posts" && posts.length > 0 && (
        <ProfileGrid posts={posts.filter((p) => !p.is_pinned)} />
      )}

      {activeTab === "posts" && posts.length === 0 && pinnedPosts.length === 0 && (
        <div className="p-16 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/[0.04] mb-4">
            <Grid3X3 className="h-7 w-7 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground" style={syne}>
            No posts yet
          </p>
          <p className="text-xs text-muted-foreground/50 mt-1.5 max-w-[220px] mx-auto">
            {isOwnProfile
              ? "Share your first post and it will show up here."
              : "When this user posts, their content will appear here."}
          </p>
        </div>
      )}

      {activeTab === "likes" && (
        isLoadingLikes ? (
          <ProfileTabSkeleton />
        ) : likedPosts.length > 0 ? (
          <div className="divide-y divide-white/[0.06]">
            {likedPosts.map((post) => (
              <PostCard key={post.id} post={post} isLiked={true} />
            ))}
          </div>
        ) : (
          <div className="p-16 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/[0.04] mb-4">
              <Heart className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">No liked posts yet</p>
            <p className="text-xs text-muted-foreground/50 mt-1.5">Posts you like will appear here.</p>
          </div>
        )
      )}

      {activeTab === "reposts" && (
        isLoadingReposts ? (
          <ProfileTabSkeleton />
        ) : repostedPosts.length > 0 ? (
          <div className="divide-y divide-white/[0.06]">
            {repostedPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="p-16 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/[0.04] mb-4">
              <Repeat2 className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">No reposts yet</p>
            <p className="text-xs text-muted-foreground/50 mt-1.5">Posts you repost will appear here.</p>
          </div>
        )
      )}

      {activeTab === "saved" && isOwnProfile && (
        isLoadingSaved ? (
          <ProfileTabSkeleton />
        ) : savedPosts.length > 0 ? (
          <div className="divide-y divide-white/[0.06]">
            {savedPosts.map((post) => (
              <PostCard key={post.id} post={post} isBookmarked={true} />
            ))}
          </div>
        ) : (
          <div className="p-16 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/[0.04] mb-4">
              <Bookmark className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">No saved posts yet</p>
            <p className="text-xs text-muted-foreground/50 mt-1.5">Tap the bookmark icon to save posts here.</p>
          </div>
        )
      )}
    </>
  );
}

function ProfileTabSkeleton() {
  return (
    <div className="divide-y divide-white/[0.06]">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-6 pt-1">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
