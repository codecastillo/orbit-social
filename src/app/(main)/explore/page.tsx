"use client";

import { useState, useEffect } from "react";
import { Search, Sparkles, TrendingUp, Hash, AlertCircle, Compass } from "lucide-react";
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
      {/* Header */}
      <div
        className="sticky top-0 z-10"
        style={{
          background: "oklch(0.14 0.02 270 / 0.7)",
          backdropFilter: "blur(40px) saturate(2)",
          WebkitBackdropFilter: "blur(40px) saturate(2)",
          borderBottom: "1px solid oklch(1 0 0 / 0.05)",
        }}
      >
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500/25 to-cyan-500/20 flex items-center justify-center border border-white/[0.06]">
            <Compass className="h-5 w-5 text-violet-300" />
          </div>
          <div>
            <h1
              className="text-2xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Discover
            </h1>
            <p className="text-[12px] text-muted-foreground mt-0.5 font-medium">
              People, tags & moments
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pb-4">
          <div className="relative">
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
        <div className="p-4">
          <SearchResults query={debouncedQuery} />
        </div>
      ) : (
        <div className="space-y-1">
          <Section icon={<Sparkles className="h-3.5 w-3.5 text-violet-300" />} label="People you may know">
            <PeopleYouMayKnow />
          </Section>

          <Section icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />} label="Trending tags">
            <TrendingHashtags />
          </Section>

          <Section icon={<Sparkles className="h-3.5 w-3.5 text-amber-300" />} label="Popular right now">
            <PopularPosts />
          </Section>

          {/* People to follow */}
          {!suggestionsError &&
            (suggestionsLoading || (suggestions && suggestions.length > 0)) && (
              <Section icon={<Sparkles className="h-3.5 w-3.5 text-cyan-300" />} label="Suggested follows">
                {suggestionsLoading ? (
                  <div className="px-5 pb-5 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
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
                  <div className="px-5 pb-5 space-y-3">
                    {suggestions!.map((profile) => (
                      <UserSuggestionCard key={profile.id} profile={profile} />
                    ))}
                  </div>
                )}
              </Section>
            )}

          {suggestionsError && (
            <div className="flex flex-col items-center py-12 text-center px-5">
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

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-white/[0.05]">
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <div className="h-6 w-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
          {icon}
        </div>
        <h2 className="text-[11px] uppercase tracking-[0.12em] font-bold text-muted-foreground">
          {label}
        </h2>
      </div>
      {children}
    </section>
  );
}

function TrendingHashtags() {
  const { data: hashtags, isLoading } = useQuery({
    queryKey: ["trending-hashtags"],
    queryFn: () => getTrendingHashtags(12),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="px-5 pb-5 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!hashtags || hashtags.length === 0) return null;

  return (
    <div className="px-5 pb-5 flex flex-wrap gap-2">
      {hashtags.map((tag) => (
        <Link
          key={tag.id}
          href={`/explore?q=%23${tag.name}`}
          className="group inline-flex items-center gap-1.5 px-3.5 h-9 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-sm font-semibold text-foreground hover:bg-white/[0.08] hover:border-primary/30 hover:text-primary transition-all"
        >
          <Hash className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          {tag.name}
          <span className="text-[11px] text-muted-foreground tabular-nums ml-1">
            {tag.post_count}
          </span>
        </Link>
      ))}
    </div>
  );
}

function PopularPosts() {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["trending-posts"],
    queryFn: () => getTrendingPosts(9),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="px-5 pb-5 grid grid-cols-3 gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!posts || posts.length === 0) return null;

  return (
    <div className="px-5 pb-5 grid grid-cols-3 gap-1.5">
      {posts.map((post: any) => {
        const media = post.post_media?.[0];
        const hasImage = media && (media.type === "image" || media.type === "video");

        return (
          <Link
            key={post.id}
            href={`/post/${post.id}`}
            className="group relative aspect-square rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06] hover:border-primary/30 hover:scale-[1.02] transition-all duration-300"
          >
            {hasImage ? (
              <img
                src={media.thumbnail_url || media.url}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center p-3 bg-gradient-to-br from-primary/15 via-violet-500/10 to-transparent">
                <p className="text-[11px] text-foreground/80 line-clamp-5 text-center leading-snug font-medium">
                  {post.content?.slice(0, 120) || ""}
                </p>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
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
  );
}
