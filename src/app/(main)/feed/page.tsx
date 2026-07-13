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
import { O, auroraSoft, panel } from "@/lib/design/orbit";
import { Eyebrow } from "@/components/orbit/primitives";

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
      <div
        className="grid gap-[18px] w-full grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px]"
        style={{
          color: O.ink,
          fontFamily: O.sans,
        }}
      >
        {/* MIDDLE, main feed column. Capped width so wide desktop viewports
            don't stretch posts (and images inside) edge-to-edge. */}
        <main className="flex flex-col gap-4 min-w-0 w-full max-w-[640px] mx-auto">
        {/* Tabs panel, only signed-in users have a follow graph; anon viewers
            see a single public timeline so the For You/Following switcher is
            meaningless and the panel is hidden. While auth is still loading,
            we reserve the panel height so the feed doesn't lurch downward
            once `user` resolves. */}
        {authLoading ? (
          <div style={{ ...panel({ borderRadius: 18 }), height: 50 }} />
        ) : user ? (
          <div
            style={{
              ...panel({ borderRadius: 18 }),
              padding: 6,
              display: "flex",
              gap: 4,
            }}
          >
            {TABS.map((t) => {
              const isActive = tab === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "10px 0",
                    borderRadius: 14,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: isActive ? auroraSoft : "transparent",
                    border: isActive
                      ? `1px solid ${O.hair2}`
                      : "1px solid transparent",
                    color: isActive ? O.ink : O.ink3,
                    transition: "all 150ms cubic-bezier(0.16,1,0.3,1)",
                  }}
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
          <div style={{ ...panel({ borderRadius: 18 }), height: 124 }} />
        ) : user ? (
          <InlineComposer />
        ) : null}

        {/* Editorial separator */}
        <div
          aria-hidden
          style={{
            height: 1,
            background: `linear-gradient(90deg, transparent, ${O.hair2} 20%, ${O.hair2} 80%, transparent)`,
            margin: "6px 2px",
          }}
        />

        {/* Pinned live-now signal */}
        <LivePinned />

        {/* Feed */}
        <FeedList tab={tab === "following" ? "following" : "foryou"} />
      </main>

        {/* RIGHT RAIL */}
        <aside className="hidden md:flex flex-col gap-[14px] sticky top-6 h-fit">
        {/* Search */}
        <div style={{ ...panel(), padding: 18 }}>
          <Link
            href="/explore"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 14px",
              borderRadius: 14,
              background: O.glass,
              border: `1px solid ${O.hair}`,
              color: O.ink3,
              textDecoration: "none",
            }}
          >
            <Search style={{ width: 16, height: 16 }} />
            <span style={{ fontSize: 13 }}>Search Orbit</span>
            <span
              style={{
                marginLeft: "auto",
                fontFamily: O.mono,
                fontSize: 10,
                color: O.ink4,
                padding: "2px 6px",
                borderRadius: 4,
                border: `1px solid ${O.hair}`,
              }}
            >
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
    <div style={{ ...panel(), padding: 0, overflow: "hidden", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, color-mix(in oklab, ${O.a1} 10%, transparent) 0%, color-mix(in oklab, ${O.a2} 8%, transparent) 50%, color-mix(in oklab, ${O.a3} 10%, transparent) 100%)`,
          pointerEvents: "none",
        }}
      />
      <div style={{ padding: 22, position: "relative" }}>
        <Eyebrow accent>◇&nbsp;&nbsp;LIVE NOW · FROM YOUR ORBIT</Eyebrow>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${featured.length}, minmax(0,1fr))`,
            gap: 12,
            marginTop: 14,
          }}
        >
          {featured.map((s) => (
            <Link
              key={s.id}
              href={`/live/${s.id}`}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: 10,
                borderRadius: 14,
                background: O.glass,
                border: `1px solid ${O.hair}`,
                color: O.ink,
                textDecoration: "none",
                minWidth: 0,
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
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.title}
                </div>
                <div style={{ fontSize: 10.5, color: O.ink3 }}>
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
    <div style={{ ...panel(), padding: 20 }}>
      <Eyebrow>◈&nbsp;&nbsp;TRENDING IN YOUR ORBIT</Eyebrow>
      {isLoading ? (
        <div style={{ marginTop: 14 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "11px 0",
                borderTop: i ? `1px solid ${O.hair}` : "none",
              }}
            >
              <div style={{ width: 22, height: 14, borderRadius: 4, background: "rgba(255,255,255,0.06)" }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ width: "60%", height: 11, borderRadius: 4, background: "rgba(255,255,255,0.06)" }} />
                <div style={{ width: "30%", height: 9, borderRadius: 4, background: "rgba(255,255,255,0.04)" }} />
              </div>
            </div>
          ))}
        </div>
      ) : !tags || tags.length === 0 ? (
        <div
          style={{
            marginTop: 14,
            fontSize: 12,
            color: O.ink3,
            lineHeight: 1.5,
          }}
        >
          Nothing orbiting yet. Post something and kick off a signal.
        </div>
      ) : (
      <div style={{ marginTop: 14 }}>
        {tags.map((t, i) => (
          <Link
            key={t.id}
            href={`/explore?q=%23${t.name}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "11px 0",
              borderTop: i ? `1px solid ${O.hair}` : "none",
              color: O.ink,
              textDecoration: "none",
            }}
          >
            <span
              style={{
                fontFamily: O.serif,
                fontSize: 22,
                fontStyle: "italic",
                color: i === 0 ? O.a2 : O.ink3,
                minWidth: 22,
              }}
            >
              {i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>#{t.name}</div>
              <div style={{ fontSize: 11, color: O.ink3 }}>{t.post_count} posts</div>
            </div>
            <TrendingUp
              style={{ width: 12, height: 12, color: "#7dffa3" }}
              strokeWidth={2}
            />
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
    <div style={{ ...panel(), padding: 20 }}>
      <Eyebrow>◇&nbsp;&nbsp;PEOPLE TO ORBIT</Eyebrow>
      {isLoading ? (
        <div style={{ marginTop: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "8px 0",
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ width: "55%", height: 11, borderRadius: 4, background: "rgba(255,255,255,0.06)" }} />
                <div style={{ width: "35%", height: 9, borderRadius: 4, background: "rgba(255,255,255,0.04)" }} />
              </div>
              <div style={{ width: 64, height: 24, borderRadius: 99, background: "rgba(255,255,255,0.05)" }} />
            </div>
          ))}
        </div>
      ) : !people || people.length === 0 ? (
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            color: O.ink3,
            lineHeight: 1.5,
          }}
        >
          No suggestions yet. Follow a few people to bring your orbit to life.
        </div>
      ) : (
      <div style={{ marginTop: 12 }}>
        {people.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: "8px 0",
            }}
          >
            <UserAvatar
              src={p.avatar_url}
              fallback={p.display_name}
              size="sm"
            />
            <Link
              href={`/${p.username}`}
              style={{ flex: 1, minWidth: 0, color: O.ink, textDecoration: "none" }}
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
