"use client";

import { useEffect, useState, use } from "react";
import { Hash } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
import { O, panel, aurora } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { OrbitEmptyState } from "@/components/orbit/empty-state";

export default function HashtagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = use(params);
  const decodedTag = decodeURIComponent(tag);
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);

  const handlePostWithTag = () => {
    if (!requireAuth()) return;
    setComposeOpen(true, { initialContent: `#${decodedTag} ` });
  };

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
    <div style={{ color: O.ink, fontFamily: O.sans, display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          ...panel({ borderRadius: 22 }),
          padding: 32,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${O.a1}1a 0%, ${O.a2}14 50%, ${O.a3}1a 100%)`,
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative" }}>
          <Eyebrow>
            ◆&nbsp;&nbsp;HASHTAG · {formatNumber(postCount)} POST{postCount !== 1 ? "S" : ""}
          </Eyebrow>
          <Display size={56} style={{ marginTop: 10, lineHeight: 0.95 }}>
            <span
              style={{
                fontFamily: O.serif,
                fontStyle: "italic",
                fontWeight: 400,
                background: aurora,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                paddingRight: "0.02em",
              }}
            >
              #
            </span>
            <Acc>{decodedTag}</Acc>
          </Display>
          <p
            style={{
              fontSize: 14.5,
              color: O.ink2,
              marginTop: 12,
              maxWidth: 520,
              lineHeight: 1.55,
            }}
          >
            Everyone in your orbit posting on this tag, freshest first.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <PillBtn primary size="lg" onClick={handlePostWithTag}>
              Post with #{decodedTag}
            </PillBtn>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : posts.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
          accent={O.a3}
          headline="Nothing"
          accentWord="on this tag"
          sub={`No posts with #${decodedTag} yet. Start the signal.`}
        />
      )}
    </div>
  );
}
