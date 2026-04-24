"use client";

import { useState, useEffect } from "react";
import { Search, Hash, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { SearchResults } from "@/components/explore/search-results";
import { UserSuggestionCard } from "@/components/explore/user-suggestion-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getSuggestedUsers,
  getTrendingHashtags,
  getTrendingPosts,
} from "@/lib/queries/social";

const TILE_CLASSES = [
  "tile-pink",
  "tile-blue",
  "tile-green",
  "tile-amber",
  "tile-violet",
  "tile-sunset",
];

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query.trim(), 300);
  const { user } = useAuth();

  const {
    data: suggestions,
    isLoading: suggestionsLoading,
    isError: suggestionsError,
    refetch: refetchSuggestions,
  } = useQuery({
    queryKey: ["suggested-users", user?.id],
    queryFn: () => getSuggestedUsers(user!.id, 8),
    enabled: !!user?.id && debouncedQuery.length === 0,
    staleTime: 1000 * 60 * 5,
  });

  const isSearching = debouncedQuery.length > 0;

  return (
    <div className="min-h-screen">
      {/* Search bar at top */}
      <div
        className="sticky top-0 z-10"
        style={{
          background: "oklch(0.14 0.02 270 / 0.7)",
          backdropFilter: "blur(40px) saturate(2)",
          WebkitBackdropFilter: "blur(40px) saturate(2)",
          borderBottom: "1px solid oklch(1 0 0 / 0.05)",
        }}
      >
        <div className="px-6 py-4">
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search people, posts, tags…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-11 pr-4 h-11 bg-white/[0.04] border border-white/[0.06] rounded-2xl text-sm placeholder:text-muted-foreground/60 focus:border-primary/40 focus:bg-white/[0.06] transition-all"
            />
          </div>
        </div>
      </div>

      {isSearching ? (
        <div className="p-6">
          <SearchResults query={debouncedQuery} />
        </div>
      ) : (
        <div className="px-6 pt-10 pb-20 max-w-6xl">
          {/* Editorial hero */}
          <div className="mb-10">
            <h1 className="hero-display">
              What&apos;s in the <em>air</em> today.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl">
              Posts, people, and tags rising on the network right now.
            </p>
          </div>

          {/* Featured trending tag — big card */}
          <FeaturedTrendingTag />

          {/* Grid of gradient popular tiles */}
          <PopularTilesGrid />

          {/* Suggestions row */}
          {!suggestionsError &&
            (suggestionsLoading || (suggestions && suggestions.length > 0)) && (
              <div className="mt-12">
                <h2 className="text-[11px] uppercase tracking-[0.14em] font-bold text-muted-foreground mb-5">
                  People to follow
                </h2>
                {suggestionsLoading ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
                      >
                        <Skeleton className="h-11 w-11 rounded-2xl" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3.5 w-28" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-9 w-[80px] rounded-xl" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {suggestions!.map((profile) => (
                      <UserSuggestionCard key={profile.id} profile={profile} />
                    ))}
                  </div>
                )}
              </div>
            )}

          {suggestionsError && (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center mb-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <p className="text-sm font-medium text-foreground/80">
                Something went wrong
              </p>
              <button
                onClick={() => refetchSuggestions()}
                className="text-primary text-sm font-semibold hover:underline mt-2"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeaturedTrendingTag() {
  const { data: hashtags, isLoading } = useQuery({
    queryKey: ["trending-hashtags"],
    queryFn: () => getTrendingHashtags(6),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="mb-10 grid md:grid-cols-3 gap-3">
        <Skeleton className="h-[220px] md:col-span-2 rounded-3xl" />
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!hashtags || hashtags.length === 0) return null;

  const featured = hashtags[0];
  const rest = hashtags.slice(1, 5);

  return (
    <div className="mb-10 grid md:grid-cols-3 gap-3">
      {/* Featured */}
      <Link
        href={`/explore?q=%23${featured.name}`}
        className="group relative md:col-span-2 h-[220px] rounded-3xl overflow-hidden tile-violet p-8 flex flex-col justify-between hover-lift"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-white/70">
            Trending now
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
        </div>
        <div>
          <h3
            className="text-6xl md:text-7xl font-extrabold text-white leading-none tracking-tight"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            #{featured.name}
          </h3>
          <p className="mt-3 text-sm text-white/80 font-semibold tabular-nums">
            {featured.post_count} posts today
          </p>
        </div>
        {/* Shine layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </Link>

      {/* Side tiles */}
      <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
        {rest.slice(0, 2).map((tag, i) => (
          <Link
            key={tag.id}
            href={`/explore?q=%23${tag.name}`}
            className={`group relative rounded-2xl overflow-hidden ${TILE_CLASSES[(i + 1) % TILE_CLASSES.length]} p-5 h-[104px] flex flex-col justify-between hover-lift`}
          >
            <Hash className="h-4 w-4 text-white/70" />
            <div>
              <p
                className="text-xl font-extrabold text-white leading-tight tracking-tight"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                #{tag.name}
              </p>
              <p className="mt-0.5 text-[11px] text-white/70 font-semibold tabular-nums">
                {tag.post_count} posts
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Extra chips underneath on mobile */}
      {rest.length > 2 && (
        <div className="md:col-span-3 flex flex-wrap gap-2">
          {rest.slice(2).map((tag) => (
            <Link
              key={tag.id}
              href={`/explore?q=%23${tag.name}`}
              className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full bg-white/[0.05] border border-white/[0.08] text-sm font-semibold text-foreground hover:bg-white/[0.1] hover:border-primary/30 hover:text-primary transition-all"
            >
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              {tag.name}
              <span className="text-[11px] text-muted-foreground tabular-nums ml-0.5">
                {tag.post_count}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function PopularTilesGrid() {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["trending-posts"],
    queryFn: () => getTrendingPosts(8),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div>
      <h2 className="text-[11px] uppercase tracking-[0.14em] font-bold text-muted-foreground mb-5">
        Popular right now
      </h2>
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
          ))}
        </div>
      ) : !posts || posts.length === 0 ? null : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {posts.map((post: any, i: number) => {
            const media = post.post_media?.[0];
            const hasImage = media && (media.type === "image" || media.type === "video");
            return (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className={`group relative aspect-[4/5] rounded-2xl overflow-hidden hover-lift ${
                  hasImage ? "" : TILE_CLASSES[i % TILE_CLASSES.length]
                }`}
              >
                {hasImage ? (
                  <img
                    src={media.thumbnail_url || media.url}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="h-full w-full flex items-end p-5">
                    <p className="text-white text-[15px] leading-snug font-bold line-clamp-5 drop-shadow">
                      {post.content?.slice(0, 160) || ""}
                    </p>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-[11px] font-bold">
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <span className="text-rose-300">♥</span>
                    {post.like_count ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <span className="text-sky-300">◌</span>
                    {post.comment_count ?? 0}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
