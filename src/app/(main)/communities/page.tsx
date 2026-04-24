"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import { CommunityCard } from "@/components/communities/community-card";
import { CreateCommunityDialog } from "@/components/communities/create-community-dialog";
import { getCommunities, searchCommunities } from "@/lib/queries/communities";
import { useAuth } from "@/lib/hooks/use-auth";

function useDebounce(v: string, d: number) {
  const [val, setVal] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setVal(v), d);
    return () => clearTimeout(t);
  }, [v, d]);
  return val;
}

export default function CommunitiesPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const { data: communities, isLoading, refetch } = useQuery({
    queryKey: ["communities", debouncedQuery],
    queryFn: () =>
      debouncedQuery.trim()
        ? searchCommunities(debouncedQuery.trim())
        : getCommunities(),
  });

  return (
    <div className="min-h-screen">
      {/* Editorial hero header */}
      <div className="px-6 pt-10 pb-6 max-w-6xl">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-2xl">
            <h1 className="hero-display">
              Small <em>places</em>. Loud enough.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl">
              Tiny communities of people who actually care about the same thing you do.
            </p>
          </div>
          {user && (
            <Button
              onClick={() => setCreateOpen(true)}
              className="rounded-full h-11 px-5 font-semibold text-sm btn-gradient shine relative overflow-hidden"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              Start a space
            </Button>
          )}
        </div>

        <div className="mt-8 max-w-lg">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search spaces…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.06] placeholder:text-muted-foreground/60 focus:border-primary/40 focus:bg-white/[0.06] transition-all"
            />
          </div>
        </div>
      </div>

      <div className="px-6 pb-20 max-w-6xl space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
        ) : communities && communities.length > 0 ? (
          communities.map((c) => (
            <CommunityCard
              key={c.id}
              community={c}
              onMembershipChange={() => refetch()}
            />
          ))
        ) : (
          <OrbitEmptyState
            icon={Users}
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
        )}
      </div>

      <CreateCommunityDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-14 w-14 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-9 w-20 rounded-2xl" />
      </div>
    </div>
  );
}
