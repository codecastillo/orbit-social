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
import {
  getCommunities,
  searchCommunities,
} from "@/lib/queries/communities";
import { useAuth } from "@/lib/hooks/use-auth";

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default function CommunitiesPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const {
    data: communities,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["communities", debouncedQuery],
    queryFn: () =>
      debouncedQuery.trim()
        ? searchCommunities(debouncedQuery.trim())
        : getCommunities(),
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/60 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
              <Users className="h-4.5 w-4.5 text-violet-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Spaces</h1>
          </div>
          {user && (
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="rounded-full py-2.5 px-5 h-auto font-medium bg-gradient-to-r from-violet-600 to-cyan-500 text-white border-0 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:brightness-110 transition-all"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="px-5 pb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search spaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 rounded-full bg-white/[0.05] border-white/[0.08] text-zinc-200 placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Space cards grid */}
      <div className="p-5 space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <CommunityCardSkeleton key={i} />
          ))
        ) : communities && communities.length > 0 ? (
          communities.map((community) => (
            <CommunityCard
              key={community.id}
              community={community}
              onMembershipChange={() => refetch()}
            />
          ))
        ) : (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl p-10">
            <EmptyState
              icon={Users}
              title={
                debouncedQuery
                  ? "No spaces found"
                  : "No spaces yet"
              }
              description={
                debouncedQuery
                  ? "Try a different search term"
                  : "Be the first to create a space!"
              }
              action={
                !debouncedQuery && user ? (
                  <Button
                    onClick={() => setCreateOpen(true)}
                    className="rounded-full px-5 bg-gradient-to-r from-violet-600 to-cyan-500 text-white border-0 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:brightness-110 transition-all"
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

      <CreateCommunityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}

function CommunityCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-14 w-14 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
    </div>
  );
}
