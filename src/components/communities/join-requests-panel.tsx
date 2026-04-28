"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import {
  getCommunityJoinRequests,
  approveCommunityRequest,
  rejectCommunityRequest,
  type CommunityJoinRequest,
} from "@/lib/queries/communities";
import { formatTimeAgo } from "@/lib/utils/format";

interface Props {
  communityId: string;
  communitySlug: string;
}

export function JoinRequestsPanel({ communityId, communitySlug }: Props) {
  const queryClient = useQueryClient();
  const [requests, setRequests] = useState<CommunityJoinRequest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refetch = async () => {
    try {
      const data = await getCommunityJoinRequests(communityId);
      setRequests(data);
    } catch (err) {
      console.error("Load join requests failed:", err);
      setRequests([]);
    }
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

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
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  const handleApprove = async (request: CommunityJoinRequest) => {
    setBusyId(request.id);
    setRequests((prev) => prev?.filter((r) => r.id !== request.id) ?? null);
    try {
      await approveCommunityRequest(request.id);
      toast.success(`Approved @${request.profiles.username}`);
      queryClient.invalidateQueries({ queryKey: ["community", communitySlug] });
      queryClient.invalidateQueries({ queryKey: ["community-members", communityId] });
    } catch (err) {
      console.error("Approve failed:", err);
      toast.error("Couldn't approve");
      refetch();
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (request: CommunityJoinRequest) => {
    setBusyId(request.id);
    setRequests((prev) => prev?.filter((r) => r.id !== request.id) ?? null);
    try {
      await rejectCommunityRequest(request.id);
      toast.success(`Rejected @${request.profiles.username}`);
    } catch (err) {
      console.error("Reject failed:", err);
      toast.error("Couldn't reject");
      refetch();
    } finally {
      setBusyId(null);
    }
  };

  if (requests === null) {
    return (
      <div className="border-b border-border px-4 py-3 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (requests.length === 0) return null;

  return (
    <div className="border-b border-border bg-amber-500/5">
      <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-amber-300/80">
        <UserPlus className="h-3.5 w-3.5" />
        <span className="text-[10px] font-mono tracking-[0.14em] font-semibold">
          PENDING REQUESTS · {requests.length}
        </span>
      </div>
      <div className="divide-y divide-border">
        {requests.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 px-4 py-3"
          >
            <Link href={`/${r.profiles.username}`} className="shrink-0">
              <UserAvatar
                src={r.profiles.avatar_url}
                fallback={r.profiles.display_name || r.profiles.username}
                size="md"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <Link
                href={`/${r.profiles.username}`}
                className="text-sm font-medium hover:underline truncate block"
              >
                {r.profiles.display_name || r.profiles.username}
              </Link>
              <div className="text-xs text-muted-foreground">
                @{r.profiles.username} · requested {formatTimeAgo(r.created_at)}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReject(r)}
                disabled={busyId === r.id}
                aria-label="Reject request"
              >
                <X className="h-4 w-4" />
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => handleApprove(r)}
                disabled={busyId === r.id}
                aria-label="Approve request"
              >
                <Check className="h-4 w-4" />
                Approve
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
