"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Grid3X3, Heart, Repeat2, Bookmark, Pin, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileGrid } from "@/components/profile/profile-grid";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getUserPosts,
  getUserLikedPosts,
  getUserBookmarkedPosts,
  getUserRepostedPosts,
  getUserPinnedPosts,
} from "@/lib/queries/posts";
import { PostCard } from "@/components/feed/post-card";
import { Skeleton } from "@/components/ui/skeleton";
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

  const { data: likedPosts = [], isLoading: loadingLikes } = useQuery({
    queryKey: ["user-liked-posts", profile.id],
    queryFn: () => getUserLikedPosts(profile.id),
    enabled: activeTab === "likes",
    staleTime: 1000 * 60,
  });

  const { data: repostedPosts = [], isLoading: loadingReposts } = useQuery({
    queryKey: ["user-reposted-posts", profile.id],
    queryFn: () => getUserRepostedPosts(profile.id),
    enabled: activeTab === "reposts",
    staleTime: 1000 * 60,
  });

  const { data: savedPosts = [], isLoading: loadingSaved } = useQuery({
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
        setIsFollowing(true);
        toast.error("Failed to unfollow");
      }
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: user.id,
        following_id: profile.id,
      });
      if (error) {
        setIsFollowing(false);
        toast.error("Failed to follow");
      }
    }
  };

  const visibleTabs = isOwnProfile ? tabs : tabs.filter((t) => t.value !== "saved");

  return (
    <div className="min-h-screen pb-20">
      {/* Back button (mobile) */}
      <div className="lg:hidden absolute top-3 left-3 z-20">
        <button
          onClick={() => router.back()}
          className="h-10 w-10 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Profile header (existing component handles cover + avatar + meta + follow CTA) */}
      <ProfileHeader
        profile={profile}
        isOwnProfile={isOwnProfile}
        isFollowing={isFollowing}
        onFollow={handleFollow}
      />

      {/* Tabs — segmented pill */}
      <div
        className="sticky top-0 lg:top-0 z-10 mt-2"
        style={{
          background: "oklch(0.14 0.02 270 / 0.7)",
          backdropFilter: "blur(40px) saturate(2)",
          WebkitBackdropFilter: "blur(40px) saturate(2)",
          borderBottom: "1px solid oklch(1 0 0 / 0.05)",
        }}
      >
        <div className="flex items-center gap-1 p-1.5 mx-4 my-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
          {visibleTabs.map((t) => {
            const isActive = activeTab === t.value;
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                onClick={() => setActiveTab(t.value)}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl text-[12px] font-bold transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-[0_4px_14px_oklch(0.623_0.214_259_/_0.4)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pt-2">
        {activeTab === "posts" && (
          <>
            {pinnedPosts.length > 0 && (
              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-2 px-2">
                  <Pin className="h-3.5 w-3.5 text-amber-300" />
                  <span className="text-[11px] uppercase tracking-wider font-bold text-amber-300">
                    Pinned
                  </span>
                </div>
                {pinnedPosts.map((p: any) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            )}
            {posts.length === 0 && pinnedPosts.length === 0 ? (
              <EmptyTab icon={<Grid3X3 className="h-6 w-6" />} label="No posts yet" />
            ) : (
              <div className="space-y-2">
                {posts.map((p: any) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "likes" && (
          loadingLikes ? <ListSkeleton /> :
          likedPosts.length === 0 ? <EmptyTab icon={<Heart className="h-6 w-6" />} label="No likes yet" /> :
          <div className="space-y-2">{likedPosts.map((p: any) => <PostCard key={p.id} post={p} />)}</div>
        )}

        {activeTab === "reposts" && (
          loadingReposts ? <ListSkeleton /> :
          repostedPosts.length === 0 ? <EmptyTab icon={<Repeat2 className="h-6 w-6" />} label="No reposts yet" /> :
          <div className="space-y-2">{repostedPosts.map((p: any) => <PostCard key={p.id} post={p} />)}</div>
        )}

        {activeTab === "saved" && isOwnProfile && (
          loadingSaved ? <ListSkeleton /> :
          savedPosts.length === 0 ? <EmptyTab icon={<Bookmark className="h-6 w-6" />} label="Nothing saved yet" /> :
          <div className="space-y-2">{savedPosts.map((p: any) => <PostCard key={p.id} post={p} />)}</div>
        )}
      </div>
    </div>
  );
}

function EmptyTab({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-3xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-muted-foreground/50 mb-4">
        {icon}
      </div>
      <p className="text-sm font-semibold text-foreground/80">{label}</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        <Sparkles className="inline h-3 w-3 mr-1 -mt-0.5" />
        Anything posted will show up here
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
