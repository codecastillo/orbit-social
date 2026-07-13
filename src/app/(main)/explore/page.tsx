"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Search, TrendingUp, Radio } from "lucide-react";
import { Input as BareInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchResults } from "@/components/explore/search-results";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getSuggestedUsers,
  getTrendingHashtags,
  getTrendingPosts,
  followUser,
} from "@/lib/queries/social";
import { getLiveStreams } from "@/lib/queries/live";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import { cn } from "@/lib/utils";

/* ─── helpers ────────────────────────────────────────────────────── */

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ─── page ───────────────────────────────────────────────────────── */

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query.trim(), 300);
  const isSearching = debouncedQuery.length > 0;

  return (
    <div className="flex flex-col gap-[22px] text-foreground">
      {/* Search strip */}
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5">
        <Search className="ml-2 h-4 w-4 text-muted-foreground" />
        <BareInput
          placeholder="Search people, posts, tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 border-0 bg-transparent h-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
        />
      </div>

      {isSearching ? (
        <div>
          <SearchResults query={debouncedQuery} />
        </div>
      ) : (
        <DiscoverBody />
      )}
    </div>
  );
}

/* ─── Discover body (hero + three rails) ─────────────────────────── */

function DiscoverBody() {
  const now = new Date();
  const today = now
    .toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" })
    .toUpperCase();

  return (
    <>
      {/* Editorial hero */}
      <div>
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          ◇&nbsp;&nbsp;DISCOVER · {today}
        </p>
        <h1 className="mt-2 text-[56px] font-bold leading-none tracking-[-0.035em] text-foreground">
          What&apos;s in the <span className="text-primary">air</span> today.
        </h1>
        <p className="mt-2.5 max-w-[640px] text-[15px] leading-normal text-text-secondary">
          Signals picked up from your orbit and its orbits. No infinite scroll, no chase.
        </p>
      </div>

      <FeaturedTrend />

      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2 xl:grid-cols-[1.1fr_1fr_1fr]">
        <TrendingRail />
        <PeopleRail />
        <LiveRail />
      </div>
    </>
  );
}

/* ─── featured #trend hero ───────────────────────────────────────── */

function FeaturedTrend() {
  const { data: tags, isLoading: tagsLoading } = useQuery({
    queryKey: ["trending-hashtags", 5],
    queryFn: () => getTrendingHashtags(5),
    staleTime: 1000 * 60 * 5,
  });
  // Over-fetch then filter to posts that actually have visual content
  // (image / video / reel). The hero tiles are visual; text-only posts
  // would render as empty cards with a "by @user" label that looks broken.
  const { data: postsRaw, isLoading: postsLoading } = useQuery({
    queryKey: ["trending-posts", 16],
    queryFn: () => getTrendingPosts(16),
    staleTime: 1000 * 60 * 5,
  });
  const posts = (postsRaw ?? [])
    .filter(
      (p) =>
        (p.type === "reel" ||
          p.type === "image" ||
          p.type === "video") &&
        Array.isArray(p.post_media) &&
        p.post_media.length > 0,
    )
    .slice(0, 4);

  if (tagsLoading || postsLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-9">
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  // Real empty state: nothing trending yet (no posts with hashtags / no
  // recent engagement). Show a hero card pointing the user at the feed
  // instead of an indefinite skeleton.
  if (!tags || tags.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface p-9 text-center">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          ◇&nbsp;&nbsp;NOTHING TRENDING · YET
        </p>
        <h1 className="mt-2 text-[32px] font-bold leading-none tracking-[-0.035em] text-foreground">
          The <span className="text-primary">air</span> is quiet today.
        </h1>
        <p className="mt-1.5 max-w-[460px] text-sm leading-normal text-text-secondary">
          No hashtags moving across your orbit yet. Drop a post with a{" "}
          <code className="font-mono text-foreground">#tag</code> and
          start the signal yourself.
        </p>
        <div className="mt-3.5">
          <Link href="/feed">
            <Button size="lg">Post yours</Button>
          </Link>
        </div>
      </div>
    );
  }

  const top = tags[0];

  return (
    <div className="grid grid-cols-1 items-stretch overflow-hidden rounded-xl border border-border bg-surface md:grid-cols-[1.1fr_1fr]">
      <div className="relative p-9">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary px-[13px] py-[5px] text-[11px] font-bold tracking-[0.1em] text-primary-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          TRENDING · {Intl.NumberFormat("en", { notation: "compact" }).format(top.post_count)}
        </div>
        <h1 className="mt-[18px] text-[64px] font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
          <span className="font-normal italic text-primary">#</span>
          {top.name}
        </h1>
        <p className="mt-4 max-w-[460px] text-[15px] leading-[1.55] text-text-secondary">
          People are posting about this across your orbit right now.{" "}
          <b className="text-foreground">{top.post_count} posts today.</b>
        </p>
        <div className="mt-[22px] flex flex-wrap gap-2.5">
          <Link href={`/hashtag/${encodeURIComponent(top.name)}`}>
            <Button size="lg">Open trend</Button>
          </Link>
          <Link href="/feed">
            <Button variant="outline" size="lg">
              Post yours
            </Button>
          </Link>
        </div>
      </div>
      <div className="relative min-h-[280px] bg-surface-elevated">
        <div className="absolute inset-3 grid grid-cols-2 grid-rows-2 gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => {
            const post = posts?.[i];
            const image = post?.post_media?.[0];
            const isImage = image?.type === "image";
            const isVideo = image?.type === "video";
            const thumbSrc = image?.thumbnail_url || (isImage ? image?.url : null);
            return (
              <Link
                key={i}
                href={post ? `/post/${post.id}` : `/hashtag/${encodeURIComponent(top.name)}`}
                className="relative overflow-hidden rounded-xl bg-surface no-underline"
              >
                {thumbSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbSrc}
                    alt=""
                    loading="lazy"
                    className="block h-full w-full object-cover"
                    onError={(e) => {
                      // Hide broken-image icon, fall back to the flat tile.
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : isVideo && image ? (
                  <video
                    src={image.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="block h-full w-full object-cover"
                  />
                ) : null}
                {post?.profiles?.username && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-2 pt-5 font-mono text-[10px] text-white/85">
                    by @{post.profiles.username}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Trending rail ──────────────────────────────────────────────── */

function TrendingRail() {
  const { data: tags, isLoading } = useQuery({
    queryKey: ["trending-hashtags", 5],
    queryFn: () => getTrendingHashtags(5),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-[22px]">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        ◈&nbsp;&nbsp;TRENDING NOW
      </p>
      <div className="mt-3.5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn("flex gap-3.5 py-3", i > 0 && "border-t border-border")}
              >
                <Skeleton className="h-6 w-6 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))
          : tags?.map((t, i) => (
              <Link
                key={t.id}
                href={`/hashtag/${encodeURIComponent(t.name)}`}
                className={cn(
                  "flex items-center gap-3.5 py-3 text-foreground no-underline",
                  i > 0 && "border-t border-border"
                )}
              >
                <span
                  className={cn(
                    "min-w-[28px] text-[26px] italic",
                    i === 0 ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">#{t.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {Intl.NumberFormat("en", { notation: "compact" }).format(t.post_count)}{" "}
                    posts
                  </div>
                </div>
                <TrendingUp className="h-[11px] w-[11px] text-emerald-400" strokeWidth={2} />
              </Link>
            ))}
      </div>
    </div>
  );
}

/* ─── People rail ────────────────────────────────────────────────── */

function PeopleRail() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: people, isLoading } = useQuery({
    queryKey: ["suggested-users", user?.id, 5],
    queryFn: () => getSuggestedUsers(user!.id, 5),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-[22px]">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        ◇&nbsp;&nbsp;PEOPLE TO ORBIT
      </p>
      <div className="mt-3.5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2.5 py-2",
                  i > 0 && "border-t border-border"
                )}
              >
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
                <Skeleton className="h-6 w-8 rounded-full" />
              </div>
            ))
          : people?.map((p, i) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-2.5 py-2",
                  i > 0 && "border-t border-border"
                )}
              >
                <UserAvatar src={p.avatar_url} fallback={p.display_name} size="sm" />
                <Link
                  href={`/${p.username}`}
                  className="min-w-0 flex-1 text-foreground no-underline"
                >
                  <div className="text-[13px] font-semibold">{p.display_name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    @{p.username}
                  </div>
                </Link>
                <FollowButton
                  isFollowing={false}
                  size="sm"
                  onToggle={async () => {
                    if (!user) return;
                    try {
                      await followUser(user.id, p.id);
                      queryClient.invalidateQueries({
                        queryKey: ["suggested-users", user.id],
                      });
                    } catch {
                      /* noop */
                    }
                  }}
                />
              </div>
            ))}
      </div>
    </div>
  );
}

/* ─── Live rail ──────────────────────────────────────────────────── */

function LiveRail() {
  const { data: streams } = useQuery({
    queryKey: ["live-streams"],
    queryFn: getLiveStreams,
    refetchInterval: 15000,
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-[22px]">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
        ◆&nbsp;&nbsp;LIVE NOW · {streams?.length ?? 0}
      </p>
      <div className="mt-3.5 flex flex-col gap-3">
        {!streams || streams.length === 0 ? (
          <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
            <Radio className="h-[13px] w-[13px] text-muted-foreground" />
            Nobody on air, come back later.
          </div>
        ) : (
          streams.slice(0, 4).map((s) => (
            <Link
              key={s.id}
              href={`/live/${s.id}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-foreground no-underline"
            >
              <div className="relative shrink-0">
                <UserAvatar
                  src={s.profiles.avatar_url}
                  fallback={s.profiles.display_name}
                  size="sm"
                />
                <span className="absolute -bottom-[3px] -right-1 rounded-sm bg-primary px-[5px] py-0.5 text-[8px] font-extrabold tracking-[0.1em] text-primary-foreground">
                  LIVE
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold">{s.title}</div>
                <div className="text-[10.5px] text-muted-foreground">
                  {s.viewer_count ?? 0} watching
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
