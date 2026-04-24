"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
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
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500/25 to-cyan-500/20 flex items-center justify-center border border-white/[0.06]">
              <Users className="h-5 w-5 text-violet-300" />
            </div>
            <div>
              <h1
                className="text-2xl font-extrabold tracking-tight"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                Spaces
              </h1>
              <p className="text-[12px] text-muted-foreground mt-0.5 font-medium">
                Find your people
              </p>
            </div>
          </div>
          {user && (
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="rounded-2xl py-2.5 px-4 h-10 font-semibold text-sm bg-primary text-primary-foreground border-0 shadow-[0_4px_16px_oklch(0.623_0.214_259_/_0.4)] hover:brightness-110 transition-all"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create
            </Button>
          )}
        </div>

        <div className="px-5 pb-4">
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

      <div className="p-5 space-y-3">
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
          <div className="rounded-3xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl p-10">
            <EmptyState
              icon={Users}
              title={debouncedQuery ? "No spaces found" : "No spaces yet"}
              description={
                debouncedQuery
                  ? "Try a different search term"
                  : "Be the first to create a space."
              }
              action={
                !debouncedQuery && user ? (
                  <Button
                    onClick={() => setCreateOpen(true)}
                    className="rounded-2xl px-5 bg-primary text-primary-foreground border-0 shadow-[0_4px_16px_oklch(0.623_0.214_259_/_0.4)] hover:brightness-110"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create Space
                  </Button>
                ) : undefined
              }
            />
          </div>
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
