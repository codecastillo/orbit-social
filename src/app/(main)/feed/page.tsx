"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, TrendingUp, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { PostComposer } from "@/components/feed/post-composer";
import { FeedList } from "@/components/feed/feed-list";
import { useAuth } from "@/lib/hooks/use-auth";
import { useCurrentProfile } from "@/lib/hooks/use-profile";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  getTrendingHashtags,
  getSuggestedUsers,
} from "@/lib/queries/social";
import { getLiveStreams } from "@/lib/queries/live";
import { UserAvatar } from "@/components/shared/user-avatar";
import { followUser } from "@/lib/queries/social";
import { FollowButton } from "@/components/shared/follow-button";
import { O, aurora, auroraSoft, panel } from "@/lib/design/orbit";
import { PillBtn, Eyebrow, Acc } from "@/components/orbit/primitives";

const TABS = [
  { value: "foryou", label: "For you" },
  { value: "following", label: "Following" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export default function FeedPage() {
  const [tab, setTab] = useState<TabValue>("foryou");
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);

  return (
    <div
      className="grid gap-[18px] w-full"
      style={{
        gridTemplateColumns: "minmax(0, 1fr) 340px",
        color: O.ink,
        fontFamily: O.sans,
      }}
    >
      <PostComposer />

      {/* MIDDLE — main feed column */}
      <main className="flex flex-col gap-4 min-w-0">
        {/* Tabs panel */}
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

        {/* Composer row */}
        {user && (
          <button
            onClick={() => setComposeOpen(true)}
            className="text-left"
            style={{
              ...panel(),
              padding: 18,
              display: "flex",
              alignItems: "center",
              gap: 14,
              cursor: "pointer",
              color: O.ink,
            }}
          >
            <UserAvatar
              src={profile?.avatar_url}
              fallback={profile?.display_name || "U"}
              size="md"
            />
            <div style={{ flex: 1, fontSize: 15, color: O.ink3 }}>
              What&apos;s <Acc>orbiting</Acc> you
              {profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}?
            </div>
            <PillBtn primary>Post</PillBtn>
          </button>
        )}

        {/* Pinned live-now signal */}
        <LivePinned />

        {/* Feed */}
        <FeedList tab={tab} />
      </main>

      {/* RIGHT RAIL */}
      <aside className="hidden xl:flex flex-col gap-[14px] sticky top-6 h-fit">
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
  );
}

/* ─── Right-rail cards ─────────────────────────────────────── */

function LivePinned() {
  const { data: streams } = useQuery({
    queryKey: ["live-streams"],
    queryFn: getLiveStreams,
    refetchInterval: 15000,
  });

  if (!streams || streams.length === 0) return null;

  const featured = streams.slice(0, 3);

  return (
    <div style={{ ...panel(), padding: 0, overflow: "hidden", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${O.a1}1a 0%, ${O.a2}14 50%, ${O.a3}1a 100%)`,
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
                    boxShadow: `0 0 10px ${O.a2}80`,
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
  const { data: tags } = useQuery({
    queryKey: ["trending-hashtags", 5],
    queryFn: () => getTrendingHashtags(5),
    staleTime: 1000 * 60 * 5,
  });

  if (!tags || tags.length === 0) return null;

  return (
    <div style={{ ...panel(), padding: 20 }}>
      <Eyebrow>◈&nbsp;&nbsp;TRENDING IN YOUR ORBIT</Eyebrow>
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
    </div>
  );
}

function PeopleToOrbitCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: people } = useQuery({
    queryKey: ["suggested-users", user?.id, 3],
    queryFn: () => getSuggestedUsers(user!.id, 3),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  if (!people || people.length === 0) return null;

  return (
    <div style={{ ...panel(), padding: 20 }}>
      <Eyebrow>◇&nbsp;&nbsp;PEOPLE TO ORBIT</Eyebrow>
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
              isFollowing={false}
              size="sm"
              onToggle={async () => {
                if (!user) return;
                await followUser(user.id, p.id);
                await queryClient.invalidateQueries({
                  queryKey: ["suggested-users", user.id, 3],
                });
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
