"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, TrendingUp } from "lucide-react";
import { InlineComposer } from "@/components/feed/post-composer";
import { FeedList } from "@/components/feed/feed-list";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getTrendingHashtags,
  getSuggestedUsers,
} from "@/lib/queries/social";
import { getLiveStreams } from "@/lib/queries/live";
import { UserAvatar } from "@/components/shared/user-avatar";
import { followUser } from "@/lib/queries/social";
import { FollowButton } from "@/components/shared/follow-button";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "foryou", label: "For you" },
  { value: "following", label: "Following" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export default function FeedPage() {
  const [tab, setTab] = useState<TabValue>("foryou");
  const { user, loading: authLoading } = useAuth();

  // On mount (and on hard refresh), the browser restores the prior scroll
  // position even though feed content takes a beat to hydrate, leaving the
  // user staring at a half-loaded post mid-page. Force the top so the tab
  // strip and composer are always visible on first paint.
  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, []);

  // Auth resolves after first paint and adds the tabs + composer above the
  // feed, pushing the user down again. Re-anchor to the top once auth has
  // finished loading so the layout shift doesn't strand them mid-page.
  useEffect(() => {
    if (!authLoading) {
      window.scrollTo(0, 0);
    }
  }, [authLoading]);

  return (
    <>
      <div className="grid gap-[18px] w-full grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] text-foreground">
        {/* MIDDLE, main feed column. Capped width so wide desktop viewports
            don't stretch posts (and images inside) edge-to-edge. */}
        <main className="flex flex-col gap-4 min-w-0 w-full max-w-[640px] mx-auto">
        {/* Tabs panel, only signed-in users have a follow graph; anon viewers
            see a single public timeline so the For You/Following switcher is
            meaningless and the panel is hidden. While auth is still loading,
            we reserve the panel height so the feed doesn't lurch downward
            once `user` resolves. */}
        {authLoading ? (
          <div className="h-[50px] rounded-2xl border border-border bg-surface" />
        ) : user ? (
          <div className="flex gap-1 rounded-2xl border border-border bg-surface p-1.5">
            {TABS.map((t) => {
              const isActive = tab === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "flex-1 cursor-pointer rounded-lg py-2.5 text-center text-[13px] font-semibold transition-all duration-150",
                    isActive
                      ? "border border-border bg-primary/10 text-foreground"
                      : "border border-transparent text-muted-foreground"
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Composer doorway. Reserve its height while auth resolves so the
            feed below doesn't shift down once a signed-in user lands. */}
        {authLoading ? (
          <div className="h-[124px] rounded-2xl border border-border bg-surface" />
        ) : user ? (
          <InlineComposer />
        ) : null}

        {/* Editorial separator */}
        <div
          aria-hidden
          className="mx-0.5 my-1.5 h-px bg-gradient-to-r from-transparent via-border to-transparent"
        />

        {/* Pinned live-now signal */}
        <LivePinned />

        {/* Feed */}
        <FeedList tab={tab === "following" ? "following" : "foryou"} />
      </main>

        {/* RIGHT RAIL */}
        <aside className="hidden md:flex flex-col gap-[14px] sticky top-6 h-fit">
        {/* Search */}
        <div className="rounded-xl border border-border bg-surface p-[18px]">
          <Link
            href="/explore"
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-[11px] text-muted-foreground no-underline"
          >
            <Search className="h-4 w-4" />
            <span className="text-[13px]">Search Orbit</span>
            <span className="ml-auto rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-faint">
              ⌘K
            </span>
          </Link>
        </div>

          <TrendingCard />
          <PeopleToOrbitCard />
        </aside>
      </div>
    </>
  );
}

/* ─── Right-rail cards ─────────────────────────────────────── */

function LivePinned() {
  const { data: streams } = useQuery({
    queryKey: ["live-streams"],
    queryFn: getLiveStreams,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  if (!streams || streams.length === 0) return null;

  const featured = streams.slice(0, 3);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface">
      <div className="pointer-events-none absolute inset-0 bg-primary/10" />
      <div className="relative p-[22px]">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
          ◇&nbsp;&nbsp;LIVE NOW · FROM YOUR ORBIT
        </p>
        <div
          className="mt-3.5 grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${featured.length}, minmax(0,1fr))`,
          }}
        >
          {featured.map((s) => (
            <Link
              key={s.id}
              href={`/live/${s.id}`}
              className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-surface p-2.5 text-foreground no-underline"
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
                <div className="truncate text-xs font-semibold">{s.title}</div>
                <div className="text-[10.5px] text-muted-foreground">
                  {s.profiles.display_name.split(" ")[0]} · {s.viewer_count ?? 0} watching
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrendingCard() {
  const { data: tags, isLoading } = useQuery({
    queryKey: ["trending-hashtags", 5],
    queryFn: () => getTrendingHashtags(5),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        ◈&nbsp;&nbsp;TRENDING IN YOUR ORBIT
      </p>
      {isLoading ? (
        <div className="mt-3.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3.5 py-[11px]",
                i > 0 && "border-t border-border"
              )}
            >
              <div className="h-3.5 w-[22px] rounded-sm bg-surface-elevated" />
              <div className="flex flex-1 flex-col gap-[5px]">
                <div className="h-[11px] w-[60%] rounded-sm bg-surface-elevated" />
                <div className="h-[9px] w-[30%] rounded-sm bg-surface-elevated" />
              </div>
            </div>
          ))}
        </div>
      ) : !tags || tags.length === 0 ? (
        <div className="mt-3.5 text-xs leading-normal text-muted-foreground">
          Nothing orbiting yet. Post something and kick off a signal.
        </div>
      ) : (
      <div className="mt-3.5">
        {tags.map((t, i) => (
          <Link
            key={t.id}
            href={`/explore?q=%23${t.name}`}
            className={cn(
              "flex items-center gap-3.5 py-[11px] text-foreground no-underline",
              i > 0 && "border-t border-border"
            )}
          >
            <span
              className={cn(
                "min-w-[22px] text-[22px] italic",
                i === 0 ? "text-primary" : "text-muted-foreground"
              )}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold">#{t.name}</div>
              <div className="text-[11px] text-muted-foreground">{t.post_count} posts</div>
            </div>
            <TrendingUp className="h-3 w-3 text-emerald-400" strokeWidth={2} />
          </Link>
        ))}
      </div>
      )}
    </div>
  );
}

function PeopleToOrbitCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [justFollowed, setJustFollowed] = useState<Set<string>>(new Set());

  const { data: people, isLoading } = useQuery({
    queryKey: ["suggested-users", user?.id, 3],
    queryFn: () => getSuggestedUsers(user!.id, 3),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        ◇&nbsp;&nbsp;PEOPLE TO ORBIT
      </p>
      {isLoading ? (
        <div className="mt-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2">
              <div className="h-8 w-8 rounded-full bg-surface-elevated" />
              <div className="flex flex-1 flex-col gap-[5px]">
                <div className="h-[11px] w-[55%] rounded-sm bg-surface-elevated" />
                <div className="h-[9px] w-[35%] rounded-sm bg-surface-elevated" />
              </div>
              <div className="h-6 w-16 rounded-full bg-surface-elevated" />
            </div>
          ))}
        </div>
      ) : !people || people.length === 0 ? (
        <div className="mt-3 text-xs leading-normal text-muted-foreground">
          No suggestions yet. Follow a few people to bring your orbit to life.
        </div>
      ) : (
      <div className="mt-3">
        {people.map((p) => (
          <div key={p.id} className="flex items-center gap-2.5 py-2">
            <UserAvatar
              src={p.avatar_url}
              fallback={p.display_name}
              size="sm"
            />
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
              isFollowing={justFollowed.has(p.id)}
              size="sm"
              onToggle={async () => {
                if (!user) return;
                setJustFollowed((s) => new Set(s).add(p.id));
                await followUser(user.id, p.id);
                await queryClient.invalidateQueries({
                  queryKey: ["suggested-users", user.id, 3],
                });
              }}
            />
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
