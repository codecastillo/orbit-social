"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, SendHorizonal, Heart, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedStar } from "@/components/orbit/verified-star";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import {
  createPost,
  getPostComments,
  getCommentReplies,
  checkUserInteractions,
  toggleLike,
  type PostWithAuthor,
} from "@/lib/queries/posts";
import { formatTimeAgo, formatNumber } from "@/lib/utils/format";

interface Props {
  postId: string;
  onClose: () => void;
}

export function ClipCommentsSheet({ postId, onClose }: Props) {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const { data: comments, isLoading } = useQuery({
    queryKey: ["clip-comments", postId],
    queryFn: () => getPostComments(postId),
  });

  // Realtime: any like / new reply / sub-reply across visible comments
  // refreshes the list and the per-comment-likes set in place. We listen
  // broadly to post_likes + posts since filtering across the comment set
  // is awkward in CDC; the invalidate is cheap.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`clip-comments-${postId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        () => {
          // The viewer's like-set per comment AND the authoritative
          // like_count on each comment row both need to refresh, the
          // count lives on posts, so we re-pull the comments + replies
          // lists too. Without this, like counts only moved when YOU
          // tapped them, not when another viewer did.
          queryClient.invalidateQueries({ queryKey: ["comment-likes"] });
          queryClient.invalidateQueries({ queryKey: ["clip-comments", postId] });
          queryClient.invalidateQueries({ queryKey: ["comment-replies"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
          filter: `parent_post_id=eq.${postId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["clip-comments", postId] });
          queryClient.invalidateQueries({ queryKey: ["comment-replies"] });
        },
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [postId, queryClient]);

  const commentIds = (comments ?? []).map((c) => c.id);

  const { data: likedSet } = useQuery({
    queryKey: ["comment-likes", user?.id, commentIds.join(",")],
    queryFn: async () => {
      if (!user || commentIds.length === 0) return new Set<string>();
      const { likedPostIds } = await checkUserInteractions(user.id, commentIds);
      return likedPostIds;
    },
    enabled: !!user && commentIds.length > 0,
  });

  const handleSend = async () => {
    if (!requireAuth() || !user) return;
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    try {
      await createPost(user.id, { content: text }, [], { replyToId: postId });
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["clip-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["clips"] });
    } catch (err) {
      console.error("Comment failed:", err);
      toast.error("Couldn't send comment");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div
      className="h-full w-full flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-border">
        <div className="text-sm font-semibold text-foreground">
          Comments {comments && `· ${comments.length}`}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-full border border-border bg-surface text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {isLoading ? (
          <div className="mt-[30px] text-center text-xs text-muted-foreground">
            Loading…
          </div>
        ) : !comments || comments.length === 0 ? (
          <div className="mt-[60px] text-center text-[12.5px] leading-normal text-muted-foreground">
            No comments yet.
            <br />
            Be the first to say something.
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {comments.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                postId={postId}
                onClose={onClose}
                initialLiked={likedSet?.has(c.id) ?? false}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 flex items-center gap-2 shrink-0 border-t border-border">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Add comment…"
          disabled={!user || posting}
          className="flex-1 rounded-lg border border-input bg-background px-3.5 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={handleSend}
          disabled={!user || posting || !draft.trim()}
          aria-label="Send"
          className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full ${
            draft.trim()
              ? "cursor-pointer bg-primary text-primary-foreground"
              : "border border-border bg-surface text-muted-foreground"
          } ${posting ? "opacity-60" : ""}`}
        >
          <SendHorizonal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  postId,
  onClose,
  initialLiked,
}: {
  comment: PostWithAuthor;
  postId: string;
  onClose: () => void;
  initialLiked: boolean;
}) {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(comment.like_count ?? 0);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // Re-seed local state when the parent's authoritative values change
  // (realtime CDC on post_likes refetches the comments list, which
  // updates comment.like_count, and refetches comment-likes which
  // updates initialLiked). Without this, comment heart counts only
  // reflect the local interaction and never see other users' likes.
  useEffect(() => {
    setLikeCount(comment.like_count ?? 0);
  }, [comment.like_count]);
  useEffect(() => {
    setLiked(initialLiked);
  }, [initialLiked]);

  const { data: replies } = useQuery({
    queryKey: ["comment-replies", comment.id],
    queryFn: () => getCommentReplies(comment.id),
    enabled: repliesOpen,
  });
  // After the 20260429070000 migration, comment_count is the direct
  // children count on intermediate comments and full subtree size on
  // root posts, so this is now reliable on a comment row.
  const replyCount = comment.comment_count ?? 0;

  const replyIds = (replies ?? []).map((r) => r.id);
  const { data: replyLikedSet } = useQuery({
    queryKey: ["comment-likes", user?.id, "replies", replyIds.join(",")],
    queryFn: async () => {
      if (!user || replyIds.length === 0) return new Set<string>();
      const { likedPostIds } = await checkUserInteractions(user.id, replyIds);
      return likedPostIds;
    },
    enabled: !!user && repliesOpen && replyIds.length > 0,
  });

  const handleLike = async () => {
    if (!requireAuth() || !user) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => (wasLiked ? c - 1 : c + 1));
    try {
      await toggleLike(user.id, comment.id, wasLiked);
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => (wasLiked ? c + 1 : c - 1));
      toast.error("Couldn't update like");
    }
  };

  const handleReplySend = async () => {
    if (!requireAuth() || !user) return;
    const text = replyDraft.trim();
    if (!text) return;
    setSendingReply(true);
    try {
      await createPost(
        user.id,
        { content: text },
        [],
        { replyToId: comment.id, parentPostId: postId },
      );
      setReplyDraft("");
      setReplying(false);
      setRepliesOpen(true);
      queryClient.invalidateQueries({
        queryKey: ["comment-replies", comment.id],
      });
      queryClient.invalidateQueries({ queryKey: ["clip-comments", postId] });
    } catch (err) {
      console.error("Reply failed:", err);
      toast.error("Couldn't send reply");
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="flex items-start gap-2.5">
      <Link href={`/${comment.profiles.username}`} onClick={onClose}>
        <UserAvatar
          src={comment.profiles.avatar_url}
          fallback={comment.profiles.display_name || comment.profiles.username}
          size="sm"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/${comment.profiles.username}`}
            onClick={onClose}
            className="text-[12.5px] font-semibold text-foreground"
          >
            {comment.profiles.display_name || comment.profiles.username}
          </Link>
          {comment.profiles.is_verified && <VerifiedStar size={10} />}
          <span className="text-[11px] text-muted-foreground">
            · {formatTimeAgo(comment.created_at)}
          </span>
        </div>
        <p className="mt-0.5 text-[13px] leading-[1.45] text-text-secondary whitespace-pre-wrap break-words">
          {comment.content}
        </p>
        <div className="flex items-center gap-4 mt-1.5">
          <button
            onClick={() => setReplying((r) => !r)}
            className="cursor-pointer text-[11px] text-muted-foreground"
          >
            Reply
          </button>
          <button
            onClick={handleLike}
            className="flex cursor-pointer items-center gap-1"
            aria-label={liked ? "Unlike" : "Like"}
          >
            <Heart
              className={`h-[13px] w-[13px] ${
                liked
                  ? "fill-primary text-primary"
                  : "fill-transparent text-muted-foreground"
              }`}
              strokeWidth={liked ? 0 : 1.8}
            />
            {likeCount > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {formatNumber(likeCount)}
              </span>
            )}
          </button>
        </div>

        {replying && (
          <div
            className="mt-2 flex items-center gap-2"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleReplySend();
              }
            }}
          >
            <input
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              placeholder={`Reply to ${comment.profiles.username}…`}
              autoFocus
              disabled={sendingReply}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={handleReplySend}
              disabled={sendingReply || !replyDraft.trim()}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                replyDraft.trim()
                  ? "cursor-pointer bg-primary text-primary-foreground"
                  : "bg-surface text-muted-foreground"
              } ${sendingReply ? "opacity-60" : ""}`}
            >
              Send
            </button>
          </div>
        )}

        {replyCount > 0 && (
          <button
            onClick={() => setRepliesOpen((o) => !o)}
            className="flex cursor-pointer items-center gap-1.5 mt-2 text-[11px] text-muted-foreground"
          >
            <span className="inline-block h-px w-3.5 bg-border" />
            View {replyCount} {replyCount === 1 ? "reply" : "replies"}
            {repliesOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        )}

        {repliesOpen && replies && (
          <div className="flex flex-col gap-3 mt-3 pl-2">
            {replies.map((r) => (
              <ReplyRow
                key={r.id}
                reply={r}
                onClose={onClose}
                initialLiked={replyLikedSet?.has(r.id) ?? false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReplyRow({
  reply,
  onClose,
  initialLiked,
}: {
  reply: PostWithAuthor;
  onClose: () => void;
  initialLiked: boolean;
}) {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(reply.like_count ?? 0);

  // Mirror the CommentRow re-seed: realtime CDC bumps reply.like_count
  // on the parent's refetch, but this child component otherwise sticks
  // to its first-render values.
  useEffect(() => {
    setLikeCount(reply.like_count ?? 0);
  }, [reply.like_count]);
  useEffect(() => {
    setLiked(initialLiked);
  }, [initialLiked]);

  const handleLike = async () => {
    if (!requireAuth() || !user) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => (wasLiked ? c - 1 : c + 1));
    try {
      await toggleLike(user.id, reply.id, wasLiked);
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => (wasLiked ? c + 1 : c - 1));
    }
  };

  return (
    <div className="flex items-start gap-2">
      <Link href={`/${reply.profiles.username}`} onClick={onClose}>
        <UserAvatar
          src={reply.profiles.avatar_url}
          fallback={reply.profiles.display_name || reply.profiles.username}
          size="sm"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/${reply.profiles.username}`}
            onClick={onClose}
            className="text-xs font-semibold text-foreground"
          >
            {reply.profiles.display_name || reply.profiles.username}
          </Link>
          {reply.profiles.is_verified && <VerifiedStar size={9} />}
          <span className="text-[10.5px] text-muted-foreground">
            · {formatTimeAgo(reply.created_at)}
          </span>
        </div>
        <p className="mt-0.5 text-[12.5px] leading-[1.4] text-text-secondary whitespace-pre-wrap break-words">
          {reply.content}
        </p>
      </div>
      <button
        onClick={handleLike}
        className="flex cursor-pointer flex-col items-center"
        aria-label={liked ? "Unlike" : "Like"}
      >
        <Heart
          className={`h-3 w-3 ${
            liked
              ? "fill-primary text-primary"
              : "fill-transparent text-muted-foreground"
          }`}
          strokeWidth={liked ? 0 : 1.8}
        />
        {likeCount > 0 && (
          <span className="mt-px text-[10px] text-muted-foreground">
            {formatNumber(likeCount)}
          </span>
        )}
      </button>
    </div>
  );
}
