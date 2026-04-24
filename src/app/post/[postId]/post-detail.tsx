"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { PostCard } from "@/components/feed/post-card";
import { PostSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Loader2 as Loader2Icon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatTimeAgo } from "@/lib/utils/format";
import {
  getPostById,
  getPostComments,
  getCommentReplies,
  checkUserInteractions,
  createPost,
  type PostWithAuthor,
} from "@/lib/queries/posts";

function CommentWithReplies({
  comment,
  interactions,
  onUpdate,
}: {
  comment: PostWithAuthor;
  interactions: { likedPostIds: Set<string>; bookmarkedPostIds: Set<string> };
  onUpdate: () => void;
}) {
  const { user } = useAuth();
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  const { data: replies, refetch: refetchReplies } = useQuery({
    queryKey: ["comment-replies", comment.id],
    queryFn: () => getCommentReplies(comment.id),
    enabled: showReplies,
  });

  const handleSubmitReply = async () => {
    if (!user || !replyContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createPost(
        user.id,
        { content: replyContent.trim() },
        [],
        { replyToId: comment.id }
      );
      setReplyContent("");
      setShowReplyComposer(false);
      setShowReplies(true);
      refetchReplies();
      toast.success("Reply posted");
      onUpdate();
    } catch {
      toast.error("Failed to post reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PostCard
        key={comment.id}
        post={comment}
        isLiked={interactions.likedPostIds.has(comment.id)}
        isBookmarked={interactions.bookmarkedPostIds.has(comment.id)}
        onUpdate={onUpdate}
        compact
      />

      {/* Reply button for the comment */}
      <div className="flex items-center gap-3 pl-16 pb-2 -mt-1">
        <button
          onClick={() => setShowReplyComposer(!showReplyComposer)}
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-sky-400 transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Reply
        </button>
        {(replies && replies.length > 0) || comment.comment_count > 0 ? (
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="text-[12px] text-primary hover:underline"
          >
            {showReplies ? "Hide replies" : `Show replies (${comment.comment_count || "..."})`}
          </button>
        ) : null}
      </div>

      {/* Inline reply composer */}
      {showReplyComposer && user && (
        <div className="pl-16 pr-4 pb-3">
          <div className="flex gap-2">
            <Textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder={`Reply to @${comment.profiles.username}...`}
              className="min-h-[40px] text-[13px] bg-white/[0.04] border-white/[0.1] rounded-lg resize-none flex-1"
              rows={2}
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleSubmitReply}
              disabled={isSubmitting || !replyContent.trim()}
              className="px-3 py-1 rounded-lg text-[12px] font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Posting..." : "Reply"}
            </button>
            <button
              onClick={() => { setShowReplyComposer(false); setReplyContent(""); }}
              className="px-3 py-1 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Nested replies */}
      {showReplies && replies && replies.length > 0 && (
        <div className="pl-10 border-l border-white/[0.06] ml-8">
          {replies.map((reply) => (
            <PostCard
              key={reply.id}
              post={reply}
              isLiked={interactions.likedPostIds.has(reply.id)}
              isBookmarked={interactions.bookmarkedPostIds.has(reply.id)}
              onUpdate={() => { refetchReplies(); onUpdate(); }}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

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
      <ReplyComposer
        postId={postId}
        onSuccess={() => {
          refetchComments();
          queryClient.invalidateQueries({ queryKey: ["post", postId] });
        }}
      />

      {/* Comments with threaded replies */}
      {commentsLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : comments && comments.length > 0 ? (
        comments.map((comment) => (
          <CommentWithReplies
            key={comment.id}
            comment={comment}
            interactions={interactions}
            onUpdate={() => refetchComments()}
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

function ReplyComposer({ postId, onSuccess }: { postId: string; onSuccess: () => void }) {
  const { user } = useAuth();
  const [content, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) return null;

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createPost(user.id, { content: content.trim() }, [], { replyToId: postId });
      setReplyContent("");
      toast.success("Reply posted");
      onSuccess();
    } catch {
      toast.error("Failed to post reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-b border-white/[0.06] p-4">
      <div className="flex gap-3">
        <div className="h-8 w-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
          {user.email?.[0]?.toUpperCase() || "U"}
        </div>
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            className="w-full bg-transparent text-sm resize-none border-none outline-none placeholder:text-muted-foreground/50 min-h-[40px]"
            rows={2}
          />
          <div className="flex justify-end mt-2">
            <Button
              size="sm"
              className="rounded-full px-5 font-semibold cursor-pointer"
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting}
            >
              {isSubmitting ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : "Reply"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
