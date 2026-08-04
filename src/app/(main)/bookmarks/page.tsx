"use client";

import { BookmarkIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/use-auth";
import { getUserBookmarkedPosts } from "@/lib/queries/posts";
import { PostCard } from "@/components/feed/post-card";
import { OrbitErrorState } from "@/components/orbit/error-state";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function BookmarksPage() {
  const { user, loading: authLoading } = useAuth();

  const { data: posts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["user-saved-posts", user?.id],
    queryFn: () => getUserBookmarkedPosts(user!.id),
    enabled: !!user?.id,
  });

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <div>
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
          ◇&nbsp;&nbsp;LIBRARY · SAVED · {posts.length}
        </p>
        <h1 className="mt-2 text-4xl sm:text-[48px] font-bold leading-none tracking-[-0.035em] text-foreground">
          Saved for <span className="text-primary">later</span>.
        </h1>
        <p className="mt-2.5 max-w-[540px] text-[14.5px] leading-[1.55] text-muted-foreground">
          Every post you bookmark lands here, ready when you come back for it.
        </p>
      </div>

      {authLoading || isLoading ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <OrbitErrorState
          headline="Couldn't load your"
          accentWord="saved posts"
          sub="Something went wrong fetching your bookmarks."
          onRetry={() => refetch()}
        />
      ) : posts.length === 0 ? (
        <OrbitEmptyState
          icon={BookmarkIcon}
          headline="Nothing"
          accentWord="saved yet"
          sub="Tap the bookmark icon on any post and it'll be waiting for you here."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} surface="profile" />
          ))}
        </div>
      )}
    </div>
  );
}
