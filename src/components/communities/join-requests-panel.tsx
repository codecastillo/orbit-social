"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserAvatar } from "@/components/shared/user-avatar";
import { createClient } from "@/lib/supabase/client";
import {
  getCommunityJoinRequests,
} from "@/lib/queries/communities";
import { JoinRequestsDialog } from "@/components/communities/join-requests-dialog";

interface Props {
  communityId: string;
  communitySlug: string;
}

export function JoinRequestsPanel({ communityId, communitySlug }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["community-join-requests", communityId],
    queryFn: () => getCommunityJoinRequests(communityId),
  });

  // Realtime: refetch when any request changes for this community.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(
        `join-requests-${communityId}-${Math.random().toString(36).slice(2)}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_join_requests",
          filter: `community_id=eq.${communityId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["community-join-requests", communityId],
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [communityId, queryClient]);

  const requests = data ?? [];
  if (requests.length === 0) return null;

  return (
    <>
      <div className="border-b border-border bg-amber-500/5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-500/10 transition-colors text-left"
          aria-label="Review join requests"
        >
          <div className="flex items-center gap-1.5 text-amber-300/90">
            <UserPlus className="h-3.5 w-3.5" />
            <span className="text-[10px] font-mono tracking-[0.14em] font-semibold">
              PENDING
            </span>
          </div>
          <div className="flex -space-x-2">
            {requests.slice(0, 4).map((r) => (
              <div
                key={r.id}
                className="ring-2 ring-background rounded-full"
                title={r.profiles.display_name || r.profiles.username}
              >
                <UserAvatar
                  src={r.profiles.avatar_url}
                  fallback={r.profiles.display_name || r.profiles.username}
                  size="sm"
                />
              </div>
            ))}
            {requests.length > 4 && (
              <div className="h-8 w-8 rounded-full bg-muted/60 ring-2 ring-background flex items-center justify-center text-[10px] font-mono font-semibold text-foreground">
                +{requests.length - 4}
              </div>
            )}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {requests.length} waiting · review →
          </span>
        </button>
      </div>

      <JoinRequestsDialog
        open={open}
        onOpenChange={setOpen}
        communityId={communityId}
        communitySlug={communitySlug}
      />
    </>
  );
}
