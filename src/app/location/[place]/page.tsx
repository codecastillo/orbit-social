"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Loader2 } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { PostCard } from "@/components/feed/post-card";
import { useAuth } from "@/lib/hooks/use-auth";
import type { PostWithAuthor } from "@/lib/queries/posts";

const POST_SELECT = `
  *,
  profiles!posts_user_id_fkey (
    id, username, display_name, avatar_url, is_verified
  ),
  post_media (
    id, type, url, thumbnail_url, width, height, blurhash, sort_order
  )
`;

async function getPostsByLocation(
  location: string,
  cursor?: string,
  limit = 20
) {
  const supabase = createClient();

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .ilike("location", location)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PostWithAuthor[];
}

export default function LocationPage() {
  const params = useParams();
  const place = decodeURIComponent(params.place as string);
  const { user } = useAuth();

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
    <div className="min-h-screen border-x border-border">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center gap-3 p-4">
          <Link
            href="/explore"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-blue-500/10 flex items-center justify-center">
              <MapPin className="h-4.5 w-4.5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-base font-bold">{place}</h1>
              <p className="text-xs text-muted-foreground">
                {allPosts.length > 0
                  ? `${allPosts.length}${hasNextPage ? "+" : ""} post${allPosts.length !== 1 ? "s" : ""}`
                  : "Location"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Posts */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : allPosts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center px-5">
          <div className="h-14 w-14 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <MapPin className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <h3 className="text-base font-semibold text-zinc-300 mb-1">
            No posts yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            No one has posted from {place} yet. Be the first!
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {allPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}

          {hasNextPage && (
            <div className="flex justify-center py-4">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
              >
                {isFetchingNextPage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Load more"
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
