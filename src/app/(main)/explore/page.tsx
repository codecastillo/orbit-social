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
    <div className="px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground">Trending</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {hashtags.map((tag) => (
          <Link
            key={tag.id}
            href={`/explore?q=%23${tag.name}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            <Hash className="h-3.5 w-3.5" />
            {tag.name}
            <span className="text-xs text-primary/60 ml-0.5">
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
    <div className="px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-semibold text-muted-foreground">Popular Posts</h2>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {posts.map((post: any) => {
          const media = post.post_media?.[0];
          const hasImage = media && (media.type === "image" || media.type === "video");

          return (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="group relative aspect-square rounded-md overflow-hidden bg-muted/30 hover:opacity-90 transition-opacity"
            >
              {hasImage ? (
                <img
                  src={media.thumbnail_url || media.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center p-2 bg-gradient-to-br from-muted/40 to-muted/20">
                  <p className="text-xs text-muted-foreground line-clamp-4 text-center leading-relaxed">
                    {post.content?.slice(0, 120) || ""}
                  </p>
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex items-center gap-3 text-white text-xs font-medium">
                  <span>{post.like_count ?? 0} likes</span>
                  <span>{post.comment_count ?? 0} comments</span>
                </div>
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
            <div className="mt-2 px-4 pb-6">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground/70" />
                People to Follow
              </h2>

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
