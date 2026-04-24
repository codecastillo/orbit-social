"use client";

import { useState, useEffect } from "react";
import { Search, Sparkles, TrendingUp, Hash, AlertCircle } from "lucide-react";
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
import { PeopleYouMayKnow } from "@/components/shared/people-you-may-know";

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function TrendingHashtagsSection() {
  const { data: hashtags, isLoading } = useQuery({
    queryKey: ["trending-hashtags"],
    queryFn: () => getTrendingHashtags(12),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!hashtags || hashtags.length === 0) return null;

  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-2 mb-3.5">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="section-label">Trending</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {hashtags.map((tag) => (
          <Link
            key={tag.id}
            href={`/explore?q=%23${tag.name}`}
            className="chip-gradient"
          >
            <Hash className="h-3.5 w-3.5" />
            {tag.name}
            <span className="text-[11px] opacity-60 ml-0.5 tabular-nums">
              {tag.post_count}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PopularPostsSection() {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["trending-posts"],
    queryFn: () => getTrendingPosts(9),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (!posts || posts.length === 0) return null;

  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-2 mb-3.5">
        <Sparkles className="h-4 w-4 text-amber-400" />
        <h2 className="section-label">Popular</h2>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {posts.map((post: any) => {
          const media = post.post_media?.[0];
          const hasImage = media && (media.type === "image" || media.type === "video");

          return (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="group relative aspect-square rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.06] shadow-md shadow-black/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/30 hover:border-white/[0.12]"
            >
              {hasImage ? (
                <img
                  src={media.thumbnail_url || media.url}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center p-3 bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent">
                  <p className="text-xs text-foreground/70 line-clamp-5 text-center leading-relaxed font-medium">
                    {post.content?.slice(0, 120) || ""}
                  </p>
                </div>
              )}

              {/* Gradient fade + stats overlay */}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <span className="text-rose-400">♥</span>
                  {post.like_count ?? 0}
                </span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <span className="text-sky-400">◌</span>
                  {post.comment_count ?? 0}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query.trim(), 300);
  const { user } = useAuth();

  const { data: suggestions, isLoading: suggestionsLoading, isError: suggestionsError, refetch: refetchSuggestions } = useQuery({
    queryKey: ["suggested-users", user?.id],
    queryFn: () => getSuggestedUsers(user!.id, 8),
    enabled: !!user?.id && debouncedQuery.length === 0,
    staleTime: 1000 * 60 * 5,
  });

  const isSearching = debouncedQuery.length > 0;

  return (
    <div className="min-h-screen">
      {/* Search bar - prominent, at the very top */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-2xl px-5 pt-4 pb-3 shadow-[0_1px_0_oklch(1_0_0_/_0.06)]">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-4 h-10 bg-muted/40 border-0 rounded-xl text-sm placeholder:text-muted-foreground/60 focus:bg-muted/60 focus:ring-1 focus:ring-border transition-all"
          />
        </div>
      </div>

      {isSearching ? (
        <div className="p-4">
          <SearchResults query={debouncedQuery} />
        </div>
      ) : (
        <div>
          {/* People You May Know */}
          <div className="border-b border-white/[0.06]">
            <PeopleYouMayKnow />
          </div>

          {/* Trending Hashtags */}
          <div className="border-b border-white/[0.06]">
            <TrendingHashtagsSection />
          </div>

          {/* Popular Posts */}
          <div className="border-b border-white/[0.06]">
            <PopularPostsSection />
          </div>

          {/* Error state */}
          {suggestionsError && (
            <div className="flex flex-col items-center py-12 text-center px-5">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <p className="text-sm font-medium text-foreground/80">
                Something went wrong
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Failed to load suggestions. Try again.
              </p>
              <button
                onClick={() => refetchSuggestions()}
                className="text-primary text-sm font-medium hover:underline mt-3"
              >
                Retry
              </button>
            </div>
          )}

          {/* People to Follow */}
          {!suggestionsError && (suggestionsLoading ||
            (suggestions && suggestions.length > 0)) && (
            <div className="mt-2 px-5 pb-8 pt-5">
              <div className="flex items-center gap-2 mb-3.5">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <h2 className="section-label">People to follow</h2>
              </div>

              {suggestionsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-11 w-11 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-8 w-[80px] rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions!.map((profile) => (
                    <UserSuggestionCard key={profile.id} profile={profile} />
                  ))}
                </div>
              )}
            </div>
          )}

          {!suggestionsLoading && !suggestionsError &&
            (!suggestions || suggestions.length === 0) && (
              <div className="flex flex-col items-center py-12 text-center px-5">
                <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                  <Sparkles className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Follow some people to get personalized suggestions.
                </p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
