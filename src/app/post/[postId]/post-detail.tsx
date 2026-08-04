"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Loader2, MessageCircle, Pin } from "lucide-react";
import { toast } from "sonner";
import { PostCard } from "@/components/feed/post-card";
import { PostSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Loader2 as Loader2Icon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { OrbitErrorState } from "@/components/orbit/error-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/hooks/use-auth";
import { useCommentFilter } from "@/lib/hooks/use-content-safety";
import { formatNumber, formatTimeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import {
  getPostById,
  getPostComments,
  getCommentReplies,
  checkUserInteractions,
  checkUserReposted,
  createPost,
  pinComment,
  canViewerComment,
  isCommentsClosedError,
  type PostWithAuthor,
} from "@/lib/queries/posts";
import { checkFollowing } from "@/lib/queries/social";

const COMMENTS_LIMITED_MESSAGE = "Comments are limited on this post";

function CommentWithReplies({
  comment,
  interactions,
  onUpdate,
  canPin,
  canComment,
}: {
  comment: PostWithAuthor;
  interactions: { likedPostIds: Set<string>; bookmarkedPostIds: Set<string>; repostedPostIds: Set<string> };
  onUpdate: () => void;
  // Viewer owns the parent post; only they can pin a comment.
  canPin: boolean;
  // Parent post's comment controls apply to replies on its thread too.
  canComment: boolean;
}) {
  const { user } = useAuth();
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  const filterComments = useCommentFilter();

  const { data: replies, refetch: refetchReplies } = useQuery({
    queryKey: ["comment-replies", comment.id],
    queryFn: () => getCommentReplies(comment.id),
    enabled: showReplies,
    // Muted words and restricted authors drop out at the hook layer.
    select: filterComments,
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
    } catch (error) {
      toast.error(
        isCommentsClosedError(error)
          ? COMMENTS_LIMITED_MESSAGE
          : "Couldn't post reply",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePin = async () => {
    try {
      await pinComment(comment.id, !comment.is_pinned);
      toast.success(comment.is_pinned ? "Comment unpinned" : "Comment pinned");
      onUpdate();
    } catch {
      toast.error("Couldn't update pin");
    }
  };

  return (
    <div>
      {comment.is_pinned && (
        <div className="flex items-center gap-1.5 px-4 pt-3 -mb-2 text-[11px] text-muted-foreground">
          <Pin className="h-3 w-3" />
          Pinned
        </div>
      )}
      <PostCard
        key={comment.id}
        post={comment}
        isLiked={interactions.likedPostIds.has(comment.id)}
        isBookmarked={interactions.bookmarkedPostIds.has(comment.id)}
        isReposted={interactions.repostedPostIds.has(comment.id)}
        onUpdate={onUpdate}
        compact
        onTogglePinComment={canPin ? handleTogglePin : undefined}
      />

      {/* Reply button for the comment */}
      <div className="flex items-center gap-3 pl-16 pb-2 -mt-1">
        {canComment && (
          <button
            onClick={() => setShowReplyComposer(!showReplyComposer)}
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-sky-400 transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Reply
          </button>
        )}
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
      {showReplyComposer && canComment && user && (
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

// Once per post per browser session: strict-mode double effects, refetches,
// and back-and-forth navigation must not count the same reader twice.
const viewedPostIds = new Set<string>();

type CommentSort = "top" | "newest";

// Short threads read best in the order they happened; past this many
// replies the best ones matter more than the latest, so Top leads.
const TOP_SORT_MIN_COMMENTS = 6;

/** Pinned always leads; the rest follow the chosen order. */
function compareComments(
  a: PostWithAuthor,
  b: PostWithAuthor,
  sort: CommentSort,
): number {
  if (a.is_pinned !== b.is_pinned) return Number(b.is_pinned) - Number(a.is_pinned);
  if (sort === "top" && a.like_count !== b.like_count) {
    return b.like_count - a.like_count;
  }
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function CommentSortToggle({
  sort,
  onChange,
}: {
  sort: CommentSort;
  onChange: (sort: CommentSort) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2">
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Replies
      </span>
      <div className="flex gap-0.5 rounded-lg border border-border bg-surface p-0.5">
        {(["top", "newest"] as const).map((value) => (
          <button
            key={value}
            onClick={() => onChange(value)}
            aria-pressed={sort === value}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors",
              sort === value
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PostDetail({ postId }: { postId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const filterComments = useCommentFilter();
  const [sortChoice, setSortChoice] = useState<CommentSort | null>(null);

  const {
    data: post,
    isLoading: postLoading,
    isError: postError,
    refetch: refetchPost,
  } = useQuery({
    queryKey: ["post", postId],
    queryFn: () => getPostById(postId),
  });

  const { data: comments, isLoading: commentsLoading, refetch: refetchComments } = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => getPostComments(postId),
    // Muted words and restricted authors drop out at the hook layer.
    select: filterComments,
  });

  const allPostIds = post ? [post.id, ...(comments || []).map((c) => c.id)] : [];

  const { data: interactions = { likedPostIds: new Set<string>(), bookmarkedPostIds: new Set<string>(), repostedPostIds: new Set<string>() } } = useQuery({
    queryKey: ["post-interactions", postId, user?.id, allPostIds.length],
    queryFn: async () => {
      if (!user || allPostIds.length === 0) return { likedPostIds: new Set<string>(), bookmarkedPostIds: new Set<string>(), repostedPostIds: new Set<string>() };
      const [interactionData, repostedIds] = await Promise.all([
        checkUserInteractions(user.id, allPostIds),
        checkUserReposted(user.id, allPostIds),
      ]);
      return { ...interactionData, repostedPostIds: repostedIds };
    },
    enabled: !!user && !!post,
    staleTime: 10_000,
  });

  // "People you follow" means the author's followees, so the client check
  // asks whether the AUTHOR follows the VIEWER. UX only: the who_can_comment
  // trigger is the real gate.
  const needsFollowCheck =
    !!post &&
    !!user &&
    post.who_can_comment === "following" &&
    post.user_id !== user.id;

  const { data: authorFollowsViewer = false } = useQuery({
    queryKey: ["author-follows-viewer", post?.user_id, user?.id],
    queryFn: async () =>
      (await checkFollowing(post!.user_id, [user!.id])).has(user!.id),
    enabled: needsFollowCheck,
    staleTime: 60_000,
  });

  // Fire-and-forget view count, only once the post is known to exist.
  useEffect(() => {
    if (!post || viewedPostIds.has(post.id)) return;
    viewedPostIds.add(post.id);
    void import("@/lib/supabase/client").then(({ createClient }) =>
      createClient()
        .rpc("increment_post_views", { p_post_id: post.id })
        .then(({ error }) => {
          if (error) console.error("increment_post_views failed", error);
        }),
    );
  }, [post]);

  if (postLoading) {
    return (
      <div className="border-x border-border min-h-screen">
        <div className="flex items-center gap-4 h-12 px-4 border-b border-border">
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="p-1.5 rounded-full hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-semibold">Post</h1>
        </div>
        <PostSkeleton />
      </div>
    );
  }

  if (postError) {
    return (
      <div className="border-x border-border min-h-screen">
        <OrbitErrorState
          headline="Couldn't load this"
          accentWord="post"
          sub="Something went wrong fetching this post."
          onRetry={() => refetchPost()}
        />
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

  // No explicit pick yet: fall back to the length-based default, which
  // settles once the comments query resolves.
  const commentList = comments ?? [];
  const sort: CommentSort =
    sortChoice ?? (commentList.length > TOP_SORT_MIN_COMMENTS ? "top" : "newest");
  const sortedComments = [...commentList].sort((a, b) => compareComments(a, b, sort));
  const canComment = canViewerComment(post, user?.id, authorFollowsViewer);

  return (
    <div className="border-x border-border min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-4 h-12 px-4 bg-background/80 backdrop-blur-xl border-b border-border">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="p-1.5 rounded-full hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-semibold">Post</h1>
      </div>

      {/* Main Post */}
      <PostCard
        post={post}
        isLiked={interactions.likedPostIds.has(post.id)}
        isBookmarked={interactions.bookmarkedPostIds.has(post.id)}
        isReposted={interactions.repostedPostIds.has(post.id)}
        onUpdate={() => queryClient.invalidateQueries({ queryKey: ["post", postId] })}
      />

      {/* Views */}
      {post.view_count > 0 && (
        <div className="flex items-center gap-1.5 border-b border-border px-[22px] py-2.5 text-[12.5px] text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          <span>{formatNumber(post.view_count)} views</span>
        </div>
      )}

      {/* Reply Composer */}
      {canComment ? (
        <ReplyComposer
          postId={postId}
          onSuccess={() => {
            refetchComments();
            queryClient.invalidateQueries({ queryKey: ["post", postId] });
          }}
        />
      ) : (
        user && (
          <p className="border-b border-white/[0.06] px-4 py-4 text-[13px] text-muted-foreground">
            {post.who_can_comment === "nobody"
              ? "Replies are turned off for this post."
              : "Only people the author follows can reply."}
          </p>
        )
      )}

      {/* Comments with threaded replies */}
      {commentsLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : sortedComments.length > 0 ? (
        <>
          {sortedComments.length > 1 && (
            <CommentSortToggle sort={sort} onChange={setSortChoice} />
          )}
          {sortedComments.map((comment) => (
            <CommentWithReplies
              key={comment.id}
              comment={comment}
              interactions={interactions}
              onUpdate={() => refetchComments()}
              canPin={user?.id === post.user_id}
              canComment={canComment}
            />
          ))}
        </>
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
    } catch (error) {
      toast.error(
        isCommentsClosedError(error)
          ? COMMENTS_LIMITED_MESSAGE
          : "Couldn't post reply",
      );
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
