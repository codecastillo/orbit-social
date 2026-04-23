"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
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
    <div className="border-x border-border min-h-screen">
      {/* Sticky search header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search posts, people, tags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 bg-secondary/50 rounded-xl border-none h-10"
            />
          </div>
        </div>
      </div>

      {isSearching ? (
        <SearchResults query={debouncedQuery} />
      ) : (
        <div>
          {/* Trending hashtags */}
          <TrendingTags />

          {/* Suggested users */}
          <div className="border-t border-border">
            <h2 className="px-4 pt-4 pb-2 text-lg font-bold">
              Who to follow
            </h2>
            {suggestionsLoading ? (
              <div>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-8 w-[100px] rounded-full" />
                  </div>
                ))}
              </div>
            ) : suggestions && suggestions.length > 0 ? (
              <div>
                {suggestions.map((profile) => (
                  <UserSuggestionCard key={profile.id} profile={profile} />
                ))}
              </div>
            ) : (
              <p className="px-4 py-8 text-sm text-muted-foreground text-center">
                Follow some people to get suggestions.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
