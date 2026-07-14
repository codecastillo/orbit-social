"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input as BareInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreateCommunityDialog } from "@/components/communities/create-community-dialog";
import {
  getCommunities,
  getMyCommunities,
  searchCommunities,
  type Community,
} from "@/lib/queries/communities";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { OrbitEmptyState } from "@/components/orbit/empty-state";

function useDebounce(v: string, d: number) {
  const [val, setVal] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setVal(v), d);
    return () => clearTimeout(t);
  }, [v, d]);
  return val;
}

function formatMembers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${n}`;
}

export default function CommunitiesPage() {
  const { user, loading: authLoading } = useAuth();
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
  // it for a frame, then re-renders moving it up to "My rooms".
  //
  // While useAuth is still resolving (cookie read on first paint), we
  // don't yet know whether to expect myCommunities at all, hold the
  // render until that race settles too.
  const myCommunitiesLoaded = authLoading
    ? false
    : !user || !!debouncedQuery.trim() || myCommunities !== undefined;
  const myIdSet = new Set((myCommunities ?? []).map((c) => c.id));
  const otherCommunities = (communities ?? []).filter((c) => !myIdSet.has(c.id));

  return (
    <div className="flex flex-col gap-[22px] text-foreground">
      {/* Editorial hero */}
      <div className="flex flex-wrap items-end justify-between gap-[18px]">
        <div>
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            ◈&nbsp;&nbsp;ROOMS
          </p>
          <h1 className="mt-2 text-[56px] font-bold leading-none tracking-[-0.035em]">
            Find your <span className="text-primary">people</span>.
          </h1>
          <p className="mt-2 max-w-[540px] text-sm leading-normal text-text-secondary">
            Tiny communities of people who actually care about the same thing you do.
          </p>
        </div>
        {user && (
          <Button size="lg" onClick={() => setCreateOpen(true)}>
            Start a room
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5">
        <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        <BareInput
          placeholder="Search rooms…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 border-0 bg-transparent h-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
        />
      </div>

      {/* Featured trio */}
      {isLoading || !myCommunitiesLoaded ? (
        <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3.5">
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
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrowGlyph}&nbsp;&nbsp;{label}
      </p>
      {/* Fixed 320px columns so a single room doesn't stretch across the
          whole row, tiles stay the same size regardless of how many you
          have. */}
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,320px)] justify-start gap-3.5">
        {communities.map((c) => (
          <Link
            key={c.id}
            href={`/communities/${c.slug}`}
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface text-foreground no-underline"
          >
            <div className="relative aspect-[4/1] w-full overflow-hidden bg-primary/10">
              {c.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.cover_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.1em] text-white">
                ◆&nbsp;&nbsp;{formatMembers(c.member_count)} MEMBERS
              </div>
            </div>
            <div className="relative flex-1 p-[18px]">
              <div className="absolute -top-6 left-[18px] flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-[2.5px] border-background bg-primary">
                {c.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.avatar_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={48}
                    height={48}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold text-primary-foreground">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="mt-7">
                <div className="text-[17px] font-semibold">{c.name}</div>
                {c.is_private && (
                  <div className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-primary">
                    PRIVATE
                  </div>
                )}
                {c.description && (
                  <p className="mt-2.5 line-clamp-2 text-[13px] leading-normal text-text-secondary">
                    {c.description}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
