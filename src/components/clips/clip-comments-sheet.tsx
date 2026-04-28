"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, SendHorizonal, Heart, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedStar } from "@/components/orbit/verified-star";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  createPost,
  getPostComments,
  getCommentReplies,
  checkUserInteractions,
  toggleLike,
  type PostWithAuthor,
} from "@/lib/queries/posts";
import { formatTimeAgo, formatNumber } from "@/lib/utils/format";
import { O } from "@/lib/design/orbit";

interface Props {
  postId: string;
  onClose: () => void;
}

export function ClipCommentsSheet({ postId, onClose }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const { data: comments, isLoading } = useQuery({
    queryKey: ["clip-comments", postId],
    queryFn: () => getPostComments(postId),
  });

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
    if (!user) {
      toast.error("Sign in to comment");
      return;
    }
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
      className="h-full flex flex-col"
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "100%",
        background: "rgba(7,8,24,0.92)",
        backdropFilter: "blur(28px) saturate(160%)",
        WebkitBackdropFilter: "blur(28px) saturate(160%)",
        border: `1px solid ${O.hair2}`,
        borderRadius: 18,
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${O.hair}` }}
      >
        <div
          style={{
            fontFamily: O.sans,
            fontSize: 14,
            fontWeight: 600,
            color: O.ink,
          }}
        >
          Comments {comments && `· ${comments.length}`}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${O.hair}`,
            display: "grid",
            placeItems: "center",
            color: O.ink,
            cursor: "pointer",
          }}
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ minHeight: 0 }}>
        {isLoading ? (
          <div
            style={{
              color: O.ink3,
              fontSize: 12,
              textAlign: "center",
              marginTop: 30,
            }}
          >
            Loading…
          </div>
        ) : !comments || comments.length === 0 ? (
          <div
            style={{
              color: O.ink3,
              fontSize: 12.5,
              textAlign: "center",
              marginTop: 60,
              lineHeight: 1.5,
            }}
          >
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

      <div
        className="px-4 py-3 flex items-center gap-2 shrink-0"
        style={{ borderTop: `1px solid ${O.hair}` }}
      >
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
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${O.hair}`,
            borderRadius: 999,
            color: O.ink,
            fontFamily: O.sans,
            fontSize: 13,
            padding: "8px 14px",
            outline: "none",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!user || posting || !draft.trim()}
          aria-label="Send"
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: draft.trim() ? O.a2 : "rgba(255,255,255,0.06)",
            border: `1px solid ${O.hair}`,
            display: "grid",
            placeItems: "center",
            color: "white",
            cursor: draft.trim() ? "pointer" : "default",
            opacity: posting ? 0.6 : 1,
          }}
        >
          <SendHorizonal style={{ width: 14, height: 14 }} />
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
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(comment.like_count ?? 0);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const replyCount = comment.comment_count ?? 0;

  const { data: replies } = useQuery({
    queryKey: ["comment-replies", comment.id],
    queryFn: () => getCommentReplies(comment.id),
    enabled: repliesOpen && replyCount > 0,
  });

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
    if (!user) {
      toast.error("Sign in to like");
      return;
    }
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
    if (!user) {
      toast.error("Sign in to reply");
      return;
    }
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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link
            href={`/${comment.profiles.username}`}
            onClick={onClose}
            style={{
              fontFamily: O.sans,
              fontSize: 12.5,
              fontWeight: 600,
              color: O.ink,
            }}
          >
            {comment.profiles.display_name || comment.profiles.username}
          </Link>
          {comment.profiles.is_verified && <VerifiedStar size={10} />}
          <span style={{ fontSize: 11, color: O.ink3 }}>
            · {formatTimeAgo(comment.created_at)}
          </span>
        </div>
        <p
          style={{
            fontFamily: O.sans,
            fontSize: 13,
            color: O.ink2,
            marginTop: 2,
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {comment.content}
        </p>
        <div className="flex items-center gap-4 mt-1.5">
          <button
            onClick={() => setReplying((r) => !r)}
            style={{
              fontFamily: O.sans,
              fontSize: 11,
              color: O.ink3,
              background: "transparent",
              border: 0,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Reply
          </button>
          <button
            onClick={handleLike}
            className="flex items-center gap-1"
            style={{ background: "transparent", border: 0, cursor: "pointer", padding: 0 }}
            aria-label={liked ? "Unlike" : "Like"}
          >
            <Heart
              style={{
                width: 13,
                height: 13,
                fill: liked ? O.a2 : "transparent",
                color: liked ? O.a2 : O.ink3,
              }}
              strokeWidth={liked ? 0 : 1.8}
            />
            {likeCount > 0 && (
              <span style={{ fontSize: 11, color: O.ink3 }}>
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
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${O.hair}`,
                borderRadius: 999,
                color: O.ink,
                fontFamily: O.sans,
                fontSize: 12.5,
                padding: "6px 12px",
                outline: "none",
              }}
            />
            <button
              onClick={handleReplySend}
              disabled={sendingReply || !replyDraft.trim()}
              style={{
                fontSize: 11,
                color: O.ink,
                background: replyDraft.trim() ? O.a2 : "rgba(255,255,255,0.06)",
                border: 0,
                borderRadius: 999,
                padding: "6px 12px",
                cursor: replyDraft.trim() ? "pointer" : "default",
                opacity: sendingReply ? 0.6 : 1,
                fontFamily: O.sans,
                fontWeight: 600,
              }}
            >
              Send
            </button>
          </div>
        )}

        {replyCount > 0 && (
          <button
            onClick={() => setRepliesOpen((o) => !o)}
            className="flex items-center gap-1.5 mt-2"
            style={{
              background: "transparent",
              border: 0,
              cursor: "pointer",
              padding: 0,
              fontFamily: O.sans,
              fontSize: 11,
              color: O.ink3,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 1,
                background: O.hair2,
              }}
            />
            View {replyCount} {replyCount === 1 ? "reply" : "replies"}
            {repliesOpen ? (
              <ChevronUp style={{ width: 12, height: 12 }} />
            ) : (
              <ChevronDown style={{ width: 12, height: 12 }} />
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
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(reply.like_count ?? 0);

  const handleLike = async () => {
    if (!user) {
      toast.error("Sign in to like");
      return;
    }
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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link
            href={`/${reply.profiles.username}`}
            onClick={onClose}
            style={{
              fontFamily: O.sans,
              fontSize: 12,
              fontWeight: 600,
              color: O.ink,
            }}
          >
            {reply.profiles.display_name || reply.profiles.username}
          </Link>
          {reply.profiles.is_verified && <VerifiedStar size={9} />}
          <span style={{ fontSize: 10.5, color: O.ink3 }}>
            · {formatTimeAgo(reply.created_at)}
          </span>
        </div>
        <p
          style={{
            fontFamily: O.sans,
            fontSize: 12.5,
            color: O.ink2,
            marginTop: 2,
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {reply.content}
        </p>
      </div>
      <button
        onClick={handleLike}
        className="flex flex-col items-center"
        style={{ background: "transparent", border: 0, cursor: "pointer", padding: 0 }}
      >
        <Heart
          style={{
            width: 12,
            height: 12,
            fill: liked ? O.a2 : "transparent",
            color: liked ? O.a2 : O.ink3,
          }}
          strokeWidth={liked ? 0 : 1.8}
        />
        {likeCount > 0 && (
          <span style={{ fontSize: 10, color: O.ink3, marginTop: 1 }}>
            {formatNumber(likeCount)}
          </span>
        )}
      </button>
    </div>
  );
}
