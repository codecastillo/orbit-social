"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Globe, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input as BareInput } from "@/components/ui/input";
import { CreateCommunityDialog } from "@/components/communities/create-community-dialog";
import {
  getCommunities,
  searchCommunities,
  type Community,
} from "@/lib/queries/communities";
import { useAuth } from "@/lib/hooks/use-auth";
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export default function CommunitiesPage() {
  const { user } = useAuth();
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
          <Eyebrow>◈&nbsp;&nbsp;ROOMS · YOURS &amp; OTHERS</Eyebrow>
          <Display size={56} style={{ marginTop: 8 }}>
            Small <Acc>places</Acc>. Loud enough.
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
            <Plus style={{ width: 14, height: 14 }} strokeWidth={2.4} /> Start a room
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
      {isLoading ? (
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
              ? "Try a different search term, or start a space yourself."
              : "No spaces yet. Spin up a room for a topic you'd defend at a dinner table. Six people who care beats six hundred who don't."
          }
          ctaLabel={user ? "Start a space" : undefined}
          ctaIcon={<Plus style={{ width: 13, height: 13 }} />}
          onCta={user ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <>
          <FeaturedTrio communities={communities.slice(0, 3)} />
          <YoursList communities={communities} />
        </>
      )}

      <CreateCommunityDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

/* ─── Featured trio (hero + 2 side) ──────────────────────────────── */

function FeaturedTrio({ communities }: { communities: Community[] }) {
  const hero = communities[0];
  const sides = communities.slice(1, 3);

  if (!hero) return null;

  const hue = hueFor(hero.id);
  const hue2 = (hue + 60) % 360;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr 1fr",
        gap: 14,
      }}
      className="md:grid-cols-[1.4fr_1fr_1fr] grid-cols-1"
    >
      {/* Hero */}
      <Link
        href={`/communities/${hero.slug}`}
        style={{
          ...panel(),
          padding: 0,
          overflow: "hidden",
          position: "relative",
          textDecoration: "none",
          color: O.ink,
        }}
      >
        <div
          style={{
            height: 180,
            background: `linear-gradient(135deg, oklch(0.68 0.18 ${hue}), oklch(0.45 0.16 ${hue2}))`,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.3), transparent 60%), repeating-linear-gradient(135deg, transparent 0 30px, rgba(255,255,255,0.06) 30px 31px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              padding: "5px 12px",
              borderRadius: 99,
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(20px)",
              fontSize: 10.5,
              fontWeight: 600,
              fontFamily: O.mono,
              letterSpacing: "0.1em",
            }}
          >
            ◆&nbsp;&nbsp;{formatMembers(hero.member_count)} MEMBERS
          </div>
        </div>
        <div style={{ padding: 22 }}>
          <Display size={26}>{hero.name}</Display>
          <div
            style={{
              fontSize: 12.5,
              color: O.ink3,
              marginTop: 4,
              fontFamily: O.mono,
              letterSpacing: "0.06em",
            }}
          >
            {formatMembers(hero.member_count).toUpperCase()} MEMBERS · {hero.is_private ? "PRIVATE" : "OPEN"}
          </div>
          {hero.description && (
            <p
              style={{
                fontSize: 13.5,
                color: O.ink2,
                lineHeight: 1.55,
                marginTop: 12,
              }}
            >
              {hero.description}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <PillBtn primary>Open room →</PillBtn>
          </div>
        </div>
      </Link>

      {/* Sides */}
      {sides.map((c) => {
        const sideHue = hueFor(c.id);
        const sideHue2 = (sideHue + 60) % 360;
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
            }}
          >
            <div
              style={{
                height: 100,
                background: `linear-gradient(135deg, oklch(0.68 0.16 ${sideHue}), oklch(0.42 0.14 ${sideHue2}))`,
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "repeating-linear-gradient(135deg, transparent 0 22px, rgba(255,255,255,0.06) 22px 23px)",
                }}
              />
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{c.name}</div>
              <div
                style={{
                  fontSize: 11,
                  color: O.ink3,
                  fontFamily: O.mono,
                  marginTop: 2,
                  letterSpacing: "0.04em",
                }}
              >
                {formatMembers(c.member_count).toUpperCase()} MEMBERS
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ─── Yours · list ───────────────────────────────────────────────── */

function YoursList({ communities }: { communities: Community[] }) {
  const list = communities.slice(0, 8);
  return (
    <div>
      <Eyebrow>◇&nbsp;&nbsp;ALL ROOMS · {communities.length}</Eyebrow>
      <div
        style={{
          ...panel(),
          padding: 0,
          marginTop: 12,
          overflow: "hidden",
        }}
      >
        {list.map((c, i) => {
          const hue = hueFor(c.id);
          const hue2 = (hue + 60) % 360;
          return (
            <Link
              key={c.id}
              href={`/communities/${c.slug}`}
              style={{
                display: "flex",
                gap: 14,
                padding: "16px 22px",
                borderTop: i ? `1px solid ${O.hair}` : "none",
                alignItems: "center",
                cursor: "pointer",
                color: O.ink,
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, oklch(0.7 0.18 ${hue}), oklch(0.45 0.16 ${hue2}))`,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                  {c.is_private && (
                    <span
                      style={{
                        fontSize: 10,
                        color: O.a3,
                        fontFamily: O.mono,
                        letterSpacing: "0.08em",
                      }}
                    >
                      PRIVATE
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: O.ink3,
                    marginTop: 2,
                  }}
                >
                  {formatMembers(c.member_count)} members · created {timeAgo(c.created_at)}
                </div>
              </div>
              {c.description && (
                <div
                  style={{
                    fontSize: 12,
                    color: O.ink2,
                    maxWidth: 320,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.description}
                </div>
              )}
              <ArrowRight style={{ width: 16, height: 16, color: O.ink3 }} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
