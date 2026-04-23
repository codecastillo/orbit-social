"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PostCard } from "@/components/feed/post-card";
import { InlineComposer } from "@/components/feed/post-composer";
import { PostSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getPostById,
  getPostComments,
  checkUserInteractions,
  type PostWithAuthor,
} from "@/lib/queries/posts";

export function PostDetail({ postId }: { postId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: post, isLoading: postLoading } = useQuery({
    queryKey: ["post", postId],
    queryFn: () => getPostById(postId),
  });

  const { data: comments, isLoading: commentsLoading, refetch: refetchComments } = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => getPostComments(postId),
  });

  const [interactions, setInteractions] = useState<{
    likedPostIds: Set<string>;
    bookmarkedPostIds: Set<string>;
  }>({ likedPostIds: new Set(), bookmarkedPostIds: new Set() });

  useEffect(() => {
    if (!user || !post || !comments) return;

    const allPostIds = [post.id, ...comments.map((c) => c.id)];
    checkUserInteractions(user.id, allPostIds).then(setInteractions);
  }, [user, post, comments]);

  if (postLoading) {
    return (
      <div className="border-x border-border min-h-screen">
        <div className="flex items-center gap-4 h-12 px-4 border-b border-border">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-full hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="font-semibold">Post</h2>
        </div>
        <PostSkeleton />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="border-x border-border min-h-screen">
        <EmptyState title="Post not found" description="This post may have been deleted." />
      </div>
    );
  }

  return (
    <div className="border-x border-border min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-4 h-12 px-4 bg-background/80 backdrop-blur-xl border-b border-border">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-full hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-semibold">Post</h2>
      </div>

      {/* Main Post */}
      <PostCard
        post={post}
        isLiked={interactions.likedPostIds.has(post.id)}
        isBookmarked={interactions.bookmarkedPostIds.has(post.id)}
        onUpdate={() => queryClient.invalidateQueries({ queryKey: ["post", postId] })}
      />

      {/* Reply Composer */}
      <div className="border-b border-border">
        <InlineComposer
          replyToId={postId}
          onSuccess={() => {
            refetchComments();
            queryClient.invalidateQueries({ queryKey: ["post", postId] });
          }}
        />
      </div>

      {/* Comments */}
      {commentsLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : comments && comments.length > 0 ? (
        comments.map((comment) => (
          <PostCard
            key={comment.id}
            post={comment}
            isLiked={interactions.likedPostIds.has(comment.id)}
            isBookmarked={interactions.bookmarkedPostIds.has(comment.id)}
            onUpdate={() => refetchComments()}
            compact
          />
        ))
      ) : (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No replies yet. Be the first to reply.
        </div>
      )}
    </div>
  );
}
