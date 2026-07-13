"use client";

import { useQuery } from "@tanstack/react-query";
import { Hash, TrendingUp, Flame } from "lucide-react";
import Link from "next/link";
import { getTrendingHashtags, getTrendingPosts } from "@/lib/queries/social";
import { PostCard } from "@/components/feed/post-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils/format";
import { useAuth } from "@/lib/hooks/use-auth";

export default function TrendingPage() {
  const { user } = useAuth();

  const { data: hashtags, isLoading: hashtagsLoading } = useQuery({
    queryKey: ["trending-hashtags"],
    queryFn: () => getTrendingHashtags(10),
    staleTime: 1000 * 60 * 5,
  });

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["trending-posts"],
    queryFn: () => getTrendingPosts(20),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-5 py-4 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-400" />
          <h1 className="text-lg font-extrabold">
            Trending
          </h1>
        </div>
      </div>

      {/* Trending Hashtags */}
      <div className="px-5 pt-5 pb-2">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
          <Hash className="h-3.5 w-3.5" />
          Trending Topics
        </h2>

        {hashtagsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            ))}
          </div>
        ) : hashtags && hashtags.length > 0 ? (
          <div className="space-y-1">
            {hashtags.map((tag, index) => (
              <Link
                key={tag.id}
                href={`/explore?q=${encodeURIComponent(`#${tag.name}`)}`}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.04] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground/50 w-5 text-right">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-bold text-[15px] group-hover:text-primary transition-colors">
                      #{tag.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatNumber(tag.post_count)} posts
                    </p>
                  </div>
                </div>
                <TrendingUp className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No trending topics right now.
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-border/40 my-2" />

      {/* Trending Posts */}
      <div className="pb-6">
        <div className="px-5 pt-3 pb-2">
          <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5" />
            Top Posts
          </h2>
        </div>

        {postsLoading ? (
          <div className="space-y-4 px-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="divide-y divide-border/30">
            {posts.map((post: any) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No trending posts right now. Check back later!
          </p>
        )}
      </div>
    </div>
  );
}
