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
      <div className="sticky top-0 z-10 bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-700/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-zinc-100">Spaces</h1>
          {user && (
            <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-violet-600 hover:bg-violet-500 text-white border-0 rounded-full">
              <Plus className="h-4 w-4 mr-1.5" />
              Create
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search spaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-800 border-zinc-700/50 text-zinc-200 placeholder:text-zinc-500"
          />
        </div>
      </div>

      {/* Community list */}
      <div className="p-4 space-y-3">
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
                <Button onClick={() => setCreateOpen(true)} className="bg-violet-600 hover:bg-violet-500 text-white border-0 rounded-full">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Space
                </Button>
              ) : undefined
            }
          />
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
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/50 p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-14 w-14 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-8 w-16 rounded-md" />
      </div>
    </div>
  );
}
