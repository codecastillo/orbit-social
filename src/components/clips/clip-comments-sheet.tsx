"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedStar } from "@/components/orbit/verified-star";
import { useAuth } from "@/lib/hooks/use-auth";
import { createPost, getPostComments } from "@/lib/queries/posts";
import { formatTimeAgo } from "@/lib/utils/format";
import { O } from "@/lib/design/orbit";

interface Props {
  postId: string;
  open: boolean;
  onClose: () => void;
}

export function ClipCommentsSheet({ postId, open, onClose }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const { data: comments, isLoading } = useQuery({
    queryKey: ["clip-comments", postId],
    queryFn: () => getPostComments(postId),
    enabled: open,
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

  if (!open) return null;

  return (
    <div
      className="absolute top-0 right-0 h-full flex flex-col z-30"
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "min(92%, 360px)",
        background: "rgba(7,8,24,0.92)",
        backdropFilter: "blur(28px) saturate(160%)",
        WebkitBackdropFilter: "blur(28px) saturate(160%)",
        borderLeft: `1px solid ${O.hair2}`,
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
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
          <div style={{ color: O.ink3, fontSize: 12, textAlign: "center", marginTop: 30 }}>
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
          <div className="flex flex-col gap-4">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5">
                <Link href={`/${c.profiles.username}`} onClick={onClose}>
                  <UserAvatar
                    src={c.profiles.avatar_url}
                    fallback={c.profiles.display_name || c.profiles.username}
                    size="sm"
                  />
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Link
                      href={`/${c.profiles.username}`}
                      onClick={onClose}
                      style={{
                        fontFamily: O.sans,
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: O.ink,
                      }}
                    >
                      {c.profiles.display_name || c.profiles.username}
                    </Link>
                    {c.profiles.is_verified && <VerifiedStar size={10} />}
                    <span style={{ fontSize: 11, color: O.ink3 }}>
                      · {formatTimeAgo(c.created_at)}
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
                    {c.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="px-4 py-3 flex items-center gap-2"
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
