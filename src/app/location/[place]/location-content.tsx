"use client";

import { MapPin, Loader2 } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/feed/post-card";
import type { PostWithAuthor } from "@/lib/queries/posts";
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

export function LocationContent({ place }: { place: string }) {
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
    <div className="flex flex-col gap-[18px] text-foreground">
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-8">
        <div className="pointer-events-none absolute inset-0 bg-primary/10" />
        <div className="relative">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
            ◇&nbsp;&nbsp;NEAR · {place.toUpperCase()}
          </p>
          <h1 className="mt-2.5 text-[52px] font-bold leading-none tracking-[-0.035em] text-foreground">
            Posts from <span className="text-primary">{place}</span>.
          </h1>
          <p className="mt-3 max-w-[540px] text-[14.5px] leading-[1.55] text-text-secondary">
            Posts with this location attached, freshest first.
          </p>
          <div className="mt-3.5 inline-flex items-center gap-1.5">
            <div className="inline-flex items-center gap-[5px] rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[11px] tracking-[0.04em] text-text-secondary">
              <MapPin className="h-[11px] w-[11px]" />
              {allPosts.length}
              {hasNextPage ? "+" : ""} POST{allPosts.length !== 1 ? "S" : ""}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : allPosts.length === 0 ? (
        <OrbitEmptyState
          icon={MapPin}
          accent="var(--primary)"
          headline="Nothing"
          accentWord="from here yet"
          sub={`No one has posted from ${place} yet. Be the first signal.`}
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          {allPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {hasNextPage && (
            <div className="flex justify-center p-3.5">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
