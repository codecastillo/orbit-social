"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { SearchResults } from "@/components/explore/search-results";
import { UserSuggestionCard } from "@/components/explore/user-suggestion-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/hooks/use-auth";
import { getSuggestedUsers } from "@/lib/queries/social";
import { cn } from "@/lib/utils";
import { PeopleYouMayKnow } from "@/components/shared/people-you-may-know";

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// Gradient palettes for mosaic tiles
const gradients = [
  "from-violet-500/60 to-fuchsia-500/60",
  "from-cyan-500/60 to-blue-500/60",
  "from-orange-400/60 to-rose-500/60",
  "from-emerald-500/60 to-teal-500/60",
  "from-pink-500/60 to-purple-500/60",
  "from-amber-400/60 to-orange-500/60",
  "from-indigo-500/60 to-violet-500/60",
  "from-rose-400/60 to-pink-500/60",
  "from-teal-400/60 to-cyan-500/60",
  "from-fuchsia-500/60 to-purple-600/60",
  "from-sky-400/60 to-indigo-500/60",
  "from-lime-400/60 to-emerald-500/60",
];

// Repeating mosaic pattern: some items span 2 rows or 2 cols
// Pattern repeats every 9 items in a 3-column grid
function getMosaicSpan(index: number): { colSpan: number; rowSpan: number } {
  const pos = index % 9;
  // Position 0: large tile (2x2)
  if (pos === 0) return { colSpan: 2, rowSpan: 2 };
  // Position 5: tall tile (1x2)
  if (pos === 5) return { colSpan: 1, rowSpan: 2 };
  // Everything else: 1x1
  return { colSpan: 1, rowSpan: 1 };
}

function MosaicGrid() {
  const tiles = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        gradient: gradients[i % gradients.length],
        span: getMosaicSpan(i),
      })),
    []
  );

  return (
    <div className="grid grid-cols-3 auto-rows-[140px] gap-[2px]">
      {tiles.map((tile) => (
        <div
          key={tile.id}
          className={cn(
            "bg-gradient-to-br rounded-sm overflow-hidden cursor-pointer hover:opacity-80 transition-opacity",
            tile.gradient
          )}
          style={{
            gridColumn: `span ${tile.span.colSpan}`,
            gridRow: `span ${tile.span.rowSpan}`,
          }}
        />
      ))}
    </div>
  );
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
      {/* Search bar - prominent, at the very top */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-border/40">
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

          {/* Mosaic explore grid */}
          <MosaicGrid />

          {/* Suggested people */}
          {(suggestionsLoading ||
            (suggestions && suggestions.length > 0)) && (
            <div className="mt-6 px-4 pb-6">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                Suggested for you
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

          {!suggestionsLoading &&
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
