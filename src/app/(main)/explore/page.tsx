"use client";

import { useState, useEffect } from "react";
import { Search, TrendingUp, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { TrendingTags } from "@/components/explore/trending-tags";
import { SearchResults } from "@/components/explore/search-results";
import { UserSuggestionCard } from "@/components/explore/user-suggestion-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/hooks/use-auth";
import { getSuggestedUsers } from "@/lib/queries/social";

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query.trim(), 300);
  const { user } = useAuth();

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["suggested-users", user?.id],
    queryFn: () => getSuggestedUsers(user!.id, 8),
    enabled: !!user?.id && debouncedQuery.length === 0,
    staleTime: 1000 * 60 * 5,
  });

  const isSearching = debouncedQuery.length > 0;

  return (
    <div className="min-h-screen">
      {/* Header with search */}
      <div className="sticky top-0 z-10 bg-background/60 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center">
              <Search className="h-4.5 w-4.5 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Discover</h1>
          </div>

          {/* Search bar — large, prominent, rounded-full, frosted glass with glow on focus */}
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              placeholder="Search posts, people, tags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-13 pr-5 h-13 bg-white/[0.05] border border-white/[0.08] rounded-full text-[15px] placeholder:text-muted-foreground/60 backdrop-blur-xl focus:bg-white/[0.06] focus:border-primary/40 focus:ring-2 focus:ring-primary/20 focus:shadow-[0_0_20px_rgba(124,58,237,0.15)] transition-all"
            />
          </div>
        </div>
      </div>

      {isSearching ? (
        <div className="p-5">
          <SearchResults query={debouncedQuery} />
        </div>
      ) : (
        <div className="space-y-2">
          {/* Trending section */}
          <div className="px-5 pt-6 pb-2">
            <div className="flex items-center gap-2.5 mb-1">
              <TrendingUp className="h-4 w-4 text-orange-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Trending Now
              </h2>
            </div>
          </div>
          <TrendingTags />

          {/* Suggested people */}
          <div className="px-5 pt-6 pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">
                People to follow
              </h2>
              {suggestions && suggestions.length > 4 && (
                <span className="text-xs font-medium text-primary cursor-pointer hover:underline">
                  See all
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Based on your network and interests
            </p>
          </div>

          {suggestionsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-5 pb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
                >
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-9 w-[90px] rounded-full" />
                </div>
              ))}
            </div>
          ) : suggestions && suggestions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-5 pb-6">
              {suggestions.map((profile) => (
                <UserSuggestionCard key={profile.id} profile={profile} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 text-center px-5">
              <div className="h-14 w-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-muted-foreground/50" />
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
