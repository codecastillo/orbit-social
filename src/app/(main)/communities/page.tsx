"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input as BareInput } from "@/components/ui/input";
import { CreateCommunityDialog } from "@/components/communities/create-community-dialog";
import {
  getCommunities,
  getMyCommunities,
  searchCommunities,
  type Community,
} from "@/lib/queries/communities";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { O, aurora, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { OrbitEmptyState } from "@/components/orbit/empty-state";

function useDebounce(v: string, d: number) {
  const [val, setVal] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setVal(v), d);
    return () => clearTimeout(t);
  }, [v, d]);
  return val;
}

function hueFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = seed.charCodeAt(i) + ((h << 5) - h);
  }
  const hues = [18, 220, 290, 145, 50, 340, 180, 265];
  return hues[Math.abs(h) % hues.length];
}

function formatMembers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${n}`;
}

export default function CommunitiesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const { data: communities, isLoading } = useQuery({
    queryKey: ["communities", debouncedQuery],
    queryFn: () =>
      debouncedQuery.trim()
        ? searchCommunities(debouncedQuery.trim())
        : getCommunities(),
  });

  const { data: myCommunities } = useQuery({
    queryKey: ["communities", "mine", user?.id],
    queryFn: () => getMyCommunities(user!.id),
    enabled: !!user && !debouncedQuery.trim(),
  });

  // Realtime: any communities row update or community_members change refreshes
  // both lists so member counts + new memberships show without refresh.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`communities-feed-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "communities" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["communities"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_members" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["communities"] });
        },
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // We need myCommunities to land before we can split the global list,
  // otherwise the page renders "All rooms" with the user's owned room in
  // it for a frame, then re-renders moving it up to "My rooms". Wait
  // until both queries are resolved when the user is signed in.
  const myCommunitiesLoaded =
    !user || !!debouncedQuery.trim() || myCommunities !== undefined;
  const myIdSet = new Set((myCommunities ?? []).map((c) => c.id));
  const otherCommunities = (communities ?? []).filter((c) => !myIdSet.has(c.id));

  return (
    <div
      style={{
        color: O.ink,
        fontFamily: O.sans,
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      {/* Editorial hero */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Eyebrow>◈&nbsp;&nbsp;ROOMS</Eyebrow>
          <Display size={56} style={{ marginTop: 8 }}>
            Find your <Acc>people</Acc>.
          </Display>
          <p
            style={{
              fontSize: 14,
              color: O.ink2,
              marginTop: 8,
              maxWidth: 540,
              lineHeight: 1.5,
            }}
          >
            Tiny communities of people who actually care about the same thing you do.
          </p>
        </div>
        {user && (
          <PillBtn primary size="lg" onClick={() => setCreateOpen(true)}>
            Start a room
          </PillBtn>
        )}
      </div>

      {/* Search */}
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
          placeholder="Search rooms…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 border-0 bg-transparent h-9 text-sm text-white placeholder:text-white/40 focus-visible:ring-0"
        />
      </div>

      {/* Featured trio */}
      {isLoading || !myCommunitiesLoaded ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr",
            gap: 14,
          }}
        >
          <Skeleton className="h-[340px] rounded-2xl" />
          <Skeleton className="h-[200px] rounded-2xl" />
          <Skeleton className="h-[200px] rounded-2xl" />
        </div>
      ) : !communities || communities.length === 0 ? (
        <OrbitEmptyState
          icon={Globe}
          headline={debouncedQuery ? "No" : "Small"}
          accentWord={debouncedQuery ? "matches" : "places"}
          sub={
            debouncedQuery
              ? "Try a different search term, or start a room yourself."
              : "No rooms yet. Spin up a room for a topic you'd defend at a dinner table. Six people who care beats six hundred who don't."
          }
        />
      ) : (
        <>
          {myCommunities && myCommunities.length > 0 && !debouncedQuery && (
            <MyRoomsSection communities={myCommunities} />
          )}
          {otherCommunities.length > 0 && (
            <MyRoomsSection
              communities={otherCommunities}
              heading={
                myCommunities && myCommunities.length > 0
                  ? `ALL ROOMS · OTHERS · ${otherCommunities.length}`
                  : `ALL ROOMS · ${otherCommunities.length}`
              }
              eyebrowGlyph="◇"
            />
          )}
        </>
      )}

      <CreateCommunityDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}


/* ─── My Rooms · big tiles ───────────────────────────────────────── */

function MyRoomsSection({
  communities,
  heading,
  eyebrowGlyph = "★",
}: {
  communities: Community[];
  heading?: string;
  eyebrowGlyph?: string;
}) {
  const label = heading ?? `MY ROOMS · ${communities.length}`;
  return (
    <div>
      <Eyebrow>{eyebrowGlyph}&nbsp;&nbsp;{label}</Eyebrow>
      <div
        style={{
          display: "grid",
          // Fixed 320px columns so a single room doesn't stretch across the
          // whole row — tiles stay the same size regardless of how many you
          // have.
          gridTemplateColumns: "repeat(auto-fill, 320px)",
          justifyContent: "start",
          gap: 14,
          marginTop: 12,
        }}
      >
        {communities.map((c) => {
          const hue = hueFor(c.id);
          const hue2 = (hue + 60) % 360;
          return (
            <Link
              key={c.id}
              href={`/communities/${c.slug}`}
              style={{
                ...panel(),
                padding: 0,
                overflow: "hidden",
                textDecoration: "none",
                color: O.ink,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  aspectRatio: "4 / 1",
                  width: "100%",
                  background: c.cover_url
                    ? "transparent"
                    : `linear-gradient(135deg, oklch(0.68 0.18 ${hue}), oklch(0.45 0.16 ${hue2}))`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {c.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.cover_url}
                    alt=""
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.25), transparent 60%), repeating-linear-gradient(135deg, transparent 0 26px, rgba(255,255,255,0.06) 26px 27px)",
                    }}
                  />
                )}
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    padding: "4px 10px",
                    borderRadius: 99,
                    background: "rgba(0,0,0,0.45)",
                    backdropFilter: "blur(20px)",
                    fontSize: 10,
                    fontWeight: 600,
                    fontFamily: O.mono,
                    letterSpacing: "0.1em",
                    color: O.ink,
                  }}
                >
                  ◆&nbsp;&nbsp;{formatMembers(c.member_count)} MEMBERS
                </div>
              </div>
              <div style={{ padding: 18, position: "relative", flex: 1 }}>
                <div
                  style={{
                    position: "absolute",
                    top: -24,
                    left: 18,
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    border: `2.5px solid ${O.bg}`,
                    background: c.avatar_url
                      ? "transparent"
                      : `linear-gradient(135deg, oklch(0.7 0.18 ${hue}), oklch(0.45 0.16 ${hue2}))`,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 14px -4px rgba(0,0,0,0.6)",
                  }}
                >
                  {c.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.avatar_url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span
                      style={{ fontSize: 18, fontWeight: 700, color: "white" }}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 28 }}>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>{c.name}</div>
                  {c.is_private && (
                    <div
                      style={{
                        fontSize: 10,
                        color: O.a3,
                        fontFamily: O.mono,
                        marginTop: 2,
                        letterSpacing: "0.08em",
                      }}
                    >
                      PRIVATE
                    </div>
                  )}
                  {c.description && (
                    <p
                      style={{
                        fontSize: 13,
                        color: O.ink2,
                        lineHeight: 1.5,
                        marginTop: 10,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {c.description}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
