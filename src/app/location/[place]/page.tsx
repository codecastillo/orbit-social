"use client";

import { useParams } from "next/navigation";
import { MapPin, Loader2 } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { PostCard } from "@/components/feed/post-card";
import type { PostWithAuthor } from "@/lib/queries/posts";
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { OrbitEmptyState } from "@/components/orbit/empty-state";

const POST_SELECT = `
  *,
  profiles!posts_user_id_fkey (
    id, username, display_name, avatar_url, is_verified
  ),
  post_media (
    id, type, url, thumbnail_url, width, height, blurhash, sort_order
  )
`;

async function getPostsByLocation(location: string, cursor?: string, limit = 20) {
  const supabase = createClient();
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .ilike("location", location)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (cursor) query = query.lt("created_at", cursor);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PostWithAuthor[];
}

export default function LocationPage() {
  const params = useParams();
  const place = decodeURIComponent(params.place as string);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["location-posts", place],
    queryFn: ({ pageParam }) => getPostsByLocation(place, pageParam),
    getNextPageParam: (lastPage) => {
      if (lastPage.length < 20) return undefined;
      return lastPage[lastPage.length - 1]?.created_at;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!place,
  });

  const allPosts = data?.pages.flat() ?? [];

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
            background: `linear-gradient(135deg, ${O.a3}1a 0%, ${O.a1}14 50%, ${O.a2}1a 100%)`,
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative" }}>
          <Eyebrow accent>
            ◇&nbsp;&nbsp;NEAR · {place.toUpperCase()}
          </Eyebrow>
          <Display size={52} style={{ marginTop: 10 }}>
            Posts from <Acc>{place}</Acc>.
          </Display>
          <p
            style={{
              fontSize: 14.5,
              color: O.ink2,
              marginTop: 12,
              maxWidth: 540,
              lineHeight: 1.55,
            }}
          >
            Posts with this location attached, freshest first.
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 99,
                background: O.glass,
                border: `1px solid ${O.hair2}`,
                fontSize: 11,
                fontFamily: O.mono,
                color: O.ink2,
                letterSpacing: "0.04em",
              }}
            >
              <MapPin style={{ width: 11, height: 11 }} />
              {allPosts.length}
              {hasNextPage ? "+" : ""} POST{allPosts.length !== 1 ? "S" : ""}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader2 style={{ width: 20, height: 20, color: O.ink3 }} className="animate-spin" />
        </div>
      ) : allPosts.length === 0 ? (
        <OrbitEmptyState
          icon={MapPin}
          accent={O.a3}
          headline="Nothing"
          accentWord="from here yet"
          sub={`No one has posted from ${place} yet. Be the first signal.`}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {allPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {hasNextPage && (
            <div style={{ display: "flex", justifyContent: "center", padding: 14 }}>
              <PillBtn size="md" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? (
                  <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                ) : (
                  "Load more"
                )}
              </PillBtn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
