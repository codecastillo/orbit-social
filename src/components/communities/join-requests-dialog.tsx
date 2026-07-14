"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { VerifiedStar } from "@/components/orbit/verified-star";
import {
  approveCommunityRequest,
  getCommunityJoinRequests,
  rejectCommunityRequest,
} from "@/lib/queries/communities";
import { formatTimeAgo } from "@/lib/utils/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  communitySlug: string;
}

export function JoinRequestsDialog({
  open,
  onOpenChange,
  communityId,
  communitySlug,
}: Props) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["community-join-requests", communityId],
    queryFn: () => getCommunityJoinRequests(communityId),
    enabled: open,
  });

  const requests = data ?? [];

  const handleApprove = async (id: string, username: string) => {
    setBusyId(id);
    try {
      await approveCommunityRequest(id);
      toast.success(`Approved @${username}`);
      queryClient.invalidateQueries({ queryKey: ["community-join-requests", communityId] });
      queryClient.invalidateQueries({ queryKey: ["community", communitySlug] });
      queryClient.invalidateQueries({ queryKey: ["community-members", communityId] });
    } catch (err) {
      console.error("Approve failed:", err);
      toast.error("Couldn't approve");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string, username: string) => {
    setBusyId(id);
    try {
      await rejectCommunityRequest(id);
      toast.success(`Rejected @${username}`);
      queryClient.invalidateQueries({ queryKey: ["community-join-requests", communityId] });
    } catch (err) {
      console.error("Reject failed:", err);
      toast.error("Couldn't reject");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border border-border bg-background">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base tracking-[0.02em] text-foreground">
            Join requests · {requests.length}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[520px] overflow-y-auto divide-y divide-border">
          {isLoading ? (
            <div className="p-4 flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
              No pending requests.
            </div>
          ) : (
            requests.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 px-5 py-3"
              >
                <Link
                  href={`/${r.profiles.username}`}
                  onClick={() => onOpenChange(false)}
                  className="shrink-0"
                >
                  <UserAvatar
                    src={r.profiles.avatar_url}
                    fallback={r.profiles.display_name || r.profiles.username}
                    size="md"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Link
                      href={`/${r.profiles.username}`}
                      onClick={() => onOpenChange(false)}
                      className="truncate text-inherit no-underline hover:underline"
                    >
                      {r.profiles.display_name || r.profiles.username}
                    </Link>
                    {r.profiles.is_verified && <VerifiedStar size={12} />}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    @{r.profiles.username} · {formatTimeAgo(r.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(r.id, r.profiles.username)}
                    disabled={busyId === r.id}
                    aria-label="Reject"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(r.id, r.profiles.username)}
                    disabled={busyId === r.id}
                    aria-label="Approve"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
