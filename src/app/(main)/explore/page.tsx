"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Search, TrendingUp, Radio } from "lucide-react";
import { Input as BareInput } from "@/components/ui/input";
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
import { O, aurora, auroraSoft, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";

/* ─── helpers ────────────────────────────────────────────────────── */

function hueFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = seed.charCodeAt(i) + ((h << 5) - h);
  }
  const hues = [18, 220, 290, 145, 50, 340, 180, 265];
  return hues[Math.abs(h) % hues.length];
}

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
    <div
      style={{
        color: O.ink,
        fontFamily: O.sans,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      {/* Search strip */}
      <div
        style={{
          ...panel(),
          padding: 10,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Search style={{ width: 16, height: 16, color: O.ink3, marginLeft: 8 }} />
        <BareInput
          placeholder="Search people, posts, tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 border-0 bg-transparent h-9 text-sm text-white placeholder:text-white/40 focus-visible:ring-0"
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
        <Eyebrow>◇&nbsp;&nbsp;DISCOVER · {today}</Eyebrow>
        <Display size={56} style={{ marginTop: 8 }}>
          What&apos;s in the <Acc>air</Acc> today.
        </Display>
        <p
          style={{
            fontSize: 15,
            color: O.ink2,
            marginTop: 10,
            maxWidth: 640,
            lineHeight: 1.5,
          }}
        >
          Signals picked up from your orbit and its orbits. No infinite scroll, no chase.
        </p>
      </div>

      <FeaturedTrend />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr 1fr",
          gap: 18,
        }}
        className="grid xl:grid-cols-[1.1fr_1fr_1fr] md:grid-cols-2 grid-cols-1"
      >
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
  // would render as empty gradient cards with a "by @user" label that
  // looks broken.
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
      <div style={{ ...panel(), padding: 36 }}>
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  // Real empty state: nothing trending yet (no posts with hashtags / no
  // recent engagement). Show a hero card pointing the user at the feed
  // instead of an indefinite skeleton.
  if (!tags || tags.length === 0) {
    return (
      <div
        style={{
          ...panel(),
          padding: 36,
          textAlign: "center",
          minHeight: 220,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Eyebrow>◇&nbsp;&nbsp;NOTHING TRENDING · YET</Eyebrow>
        <Display size={32} style={{ marginTop: 8 }}>
          The <Acc>air</Acc> is quiet today.
        </Display>
        <p
          style={{
            fontSize: 14,
            color: O.ink2,
            marginTop: 6,
            maxWidth: 460,
            lineHeight: 1.5,
          }}
        >
          No hashtags moving across your orbit yet. Drop a post with a{" "}
          <code style={{ fontFamily: O.mono, color: O.ink }}>#tag</code> and
          start the signal yourself.
        </p>
        <div style={{ marginTop: 14 }}>
          <Link href="/feed">
            <PillBtn primary size="lg">
              Post yours
            </PillBtn>
          </Link>
        </div>
      </div>
    );
  }

  const top = tags[0];
  const hues = [18, 220, 290, 145];

  return (
    <div
      style={{
        ...panel(),
        padding: 0,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "1.1fr 1fr",
        alignItems: "stretch",
      }}
      className="md:grid-cols-[1.1fr_1fr] grid-cols-1"
    >
      <div style={{ padding: 36, position: "relative" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 13px",
            borderRadius: 99,
            background: aurora,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            boxShadow: `0 4px 16px color-mix(in oklab, ${O.a2} 38%, transparent)`,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "white",
              boxShadow: "0 0 8px white",
            }}
          />
          TRENDING · {Intl.NumberFormat("en", { notation: "compact" }).format(top.post_count)}
        </div>
        <Display size={64} style={{ marginTop: 18, lineHeight: 0.95 }}>
          <span
            style={{
              fontFamily: O.serif,
              fontStyle: "italic",
              fontWeight: 400,
            }}
          >
            #
          </span>
          {top.name}
        </Display>
        <p
          style={{
            fontSize: 15,
            color: O.ink2,
            lineHeight: 1.55,
            margin: "16px 0 0",
            maxWidth: 460,
          }}
        >
          People are posting about this across your orbit right now.{" "}
          <b style={{ color: O.ink }}>{top.post_count} posts today.</b>
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          <Link href={`/hashtag/${encodeURIComponent(top.name)}`}>
            <PillBtn primary size="lg">
              Open trend
            </PillBtn>
          </Link>
          <Link href="/feed">
            <PillBtn size="lg">Post yours</PillBtn>
          </Link>
        </div>
      </div>
      <div
        style={{
          position: "relative",
          background: O.glass2,
          minHeight: 280,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: 10,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => {
            const post = posts?.[i];
            const hue = hues[i];
            const hue2 = (hue + 60) % 360;
            const image = post?.post_media?.[0];
            const isImage = image?.type === "image";
            const isVideo = image?.type === "video";
            const thumbSrc = image?.thumbnail_url || (isImage ? image?.url : null);
            const gradient = `linear-gradient(135deg, oklch(0.55 0.18 ${hue}), oklch(0.35 0.12 ${hue2}))`;
            return (
              <Link
                key={i}
                href={post ? `/post/${post.id}` : `/hashtag/${encodeURIComponent(top.name)}`}
                style={{
                  borderRadius: 14,
                  overflow: "hidden",
                  position: "relative",
                  background: gradient,
                  textDecoration: "none",
                  color: "white",
                }}
              >
                {thumbSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbSrc}
                    alt=""
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    onError={(e) => {
                      // Hide broken-image icon, fall back to gradient.
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : isVideo && image ? (
                  <video
                    src={image.url}
                    muted
                    playsInline
                    preload="metadata"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "repeating-linear-gradient(135deg, transparent 0 14px, rgba(255,255,255,0.05) 14px 15px)",
                    }}
                  />
                )}
                {post?.profiles?.username && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      left: 10,
                      fontSize: 10,
                      color: "white",
                      opacity: 0.85,
                      fontFamily: O.mono,
                    }}
                  >
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
    <div style={{ ...panel(), padding: 22 }}>
      <Eyebrow>◈&nbsp;&nbsp;TRENDING NOW</Eyebrow>
      <div style={{ marginTop: 14 }}>
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: "12px 0",
                  borderTop: i ? `1px solid ${O.hair}` : "none",
                }}
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
                style={{
                  display: "flex",
                  gap: 14,
                  padding: "12px 0",
                  borderTop: i ? `1px solid ${O.hair}` : "none",
                  alignItems: "center",
                  color: O.ink,
                  textDecoration: "none",
                }}
              >
                <span
                  style={{
                    fontFamily: O.serif,
                    fontStyle: "italic",
                    fontSize: 26,
                    color: i === 0 ? O.a2 : O.ink3,
                    minWidth: 28,
                  }}
                >
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>#{t.name}</div>
                  <div style={{ fontSize: 11, color: O.ink3 }}>
                    {Intl.NumberFormat("en", { notation: "compact" }).format(t.post_count)}{" "}
                    posts
                  </div>
                </div>
                <TrendingUp
                  style={{ width: 11, height: 11, color: "#7dffa3" }}
                  strokeWidth={2}
                />
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
    <div style={{ ...panel(), padding: 22 }}>
      <Eyebrow>◇&nbsp;&nbsp;PEOPLE TO ORBIT</Eyebrow>
      <div style={{ marginTop: 14 }}>
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 0",
                  borderTop: i ? `1px solid ${O.hair}` : "none",
                }}
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
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 0",
                  borderTop: i ? `1px solid ${O.hair}` : "none",
                }}
              >
                <UserAvatar src={p.avatar_url} fallback={p.display_name} size="sm" />
                <Link
                  href={`/${p.username}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    color: O.ink,
                    textDecoration: "none",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.display_name}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: O.ink3,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
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
    <div style={{ ...panel(), padding: 22 }}>
      <Eyebrow accent>
        ◆&nbsp;&nbsp;LIVE NOW · {streams?.length ?? 0}
      </Eyebrow>
      <div
        style={{
          marginTop: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {!streams || streams.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: O.ink3,
              padding: "12px 0",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Radio style={{ width: 13, height: 13, color: O.ink3 }} />
            Nobody on air, come back later.
          </div>
        ) : (
          streams.slice(0, 4).map((s) => (
            <Link
              key={s.id}
              href={`/live/${s.id}`}
              style={{
                display: "flex",
                gap: 12,
                padding: 12,
                borderRadius: 14,
                background: O.glass,
                border: `1px solid ${O.hair}`,
                alignItems: "center",
                color: O.ink,
                textDecoration: "none",
              }}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                <UserAvatar
                  src={s.profiles.avatar_url}
                  fallback={s.profiles.display_name}
                  size="sm"
                />
                <span
                  style={{
                    position: "absolute",
                    bottom: -3,
                    right: -4,
                    background: O.a2,
                    color: "white",
                    fontSize: 8,
                    fontWeight: 800,
                    padding: "2px 5px",
                    borderRadius: 4,
                    letterSpacing: "0.1em",
                    boxShadow: `0 0 10px color-mix(in oklab, ${O.a2} 50%, transparent)`,
                  }}
                >
                  LIVE
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.title}
                </div>
                <div style={{ fontSize: 10.5, color: O.ink3 }}>
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
