"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Hash, Loader2 } from "lucide-react";
import { PostCard } from "@/components/feed/post-card";
import { PostSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getPostsByHashtag,
  checkUserInteractions,
  type PostWithAuthor,
} from "@/lib/queries/posts";
import { formatNumber } from "@/lib/utils/format";
import { use } from "react";

export default function HashtagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = use(params);
  const decodedTag = decodeURIComponent(tag);
  const router = useRouter();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["hashtag", decodedTag],
    queryFn: () => getPostsByHashtag(decodedTag),
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
    <div className="border-x border-border min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-4 h-12 px-4">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-full hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="font-semibold flex items-center gap-1">
              <Hash className="h-4 w-4" />
              {decodedTag}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {formatNumber(postCount)} post{postCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Posts */}
      {isLoading ? (
        <div>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : posts.length > 0 ? (
        <div className="divide-y divide-border">
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
        <EmptyState
          title="No posts found"
          description={`No posts with #${decodedTag} yet.`}
        />
      )}
    </div>
  );
}
