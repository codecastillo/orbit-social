"use client";

import { useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/feed/post-card";
import { PostSkeleton } from "@/components/shared/loading-skeleton";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  getPostsByHashtag,
  checkUserInteractions,
} from "@/lib/queries/posts";
import { formatNumber } from "@/lib/utils/format";
import { OrbitEmptyState } from "@/components/orbit/empty-state";

export function HashtagContent({ tag }: { tag: string }) {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);

  const handlePostWithTag = () => {
    if (!requireAuth()) return;
    setComposeOpen(true, { initialContent: `#${tag} ` });
  };

  const { data, isLoading } = useQuery({
    queryKey: ["hashtag", tag],
    queryFn: () => getPostsByHashtag(tag),
  });

  const posts = data?.posts ?? [];
  const postCount = data?.postCount ?? 0;

  const [interactions, setInteractions] = useState<{
    likedPostIds: Set<string>;
    bookmarkedPostIds: Set<string>;
  }>({ likedPostIds: new Set(), bookmarkedPostIds: new Set() });

  useEffect(() => {
    if (!user || posts.length === 0) return;
    const postIds = posts.map((p) => p.id);
    checkUserInteractions(user.id, postIds).then(setInteractions);
  }, [user, posts]);

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-8">
        <div className="pointer-events-none absolute inset-0 bg-primary/10" />
        <div className="relative">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            ◆&nbsp;&nbsp;HASHTAG · {formatNumber(postCount)} POST{postCount !== 1 ? "S" : ""}
          </p>
          <h1 className="mt-2.5 text-[56px] font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
            <span className="pr-[0.02em] font-normal italic text-primary">#</span>
            <span className="text-primary">{tag}</span>
          </h1>
          <p className="mt-3 max-w-[520px] text-[14.5px] leading-[1.55] text-text-secondary">
            Everyone in your orbit posting on this tag, freshest first.
          </p>
          <div className="mt-[18px] flex gap-2.5">
            <Button size="lg" onClick={handlePostWithTag}>
              Post with #{tag}
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3.5">
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : posts.length > 0 ? (
        <div className="flex flex-col gap-3.5">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isLiked={interactions.likedPostIds.has(post.id)}
              isBookmarked={interactions.bookmarkedPostIds.has(post.id)}
            />
          ))}
        </div>
      ) : (
        <OrbitEmptyState
          icon={Hash}
          accent="var(--primary)"
          headline="Nothing"
          accentWord="on this tag"
          sub={`No posts with #${tag} yet. Start the signal.`}
        />
      )}
    </div>
  );
}
