"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/shared/user-avatar";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import { OrbitErrorState } from "@/components/orbit/error-state";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatTimeAgo } from "@/lib/utils/format";
import {
  approveFollowRequest,
  cancelFollowRequest,
  getIncomingFollowRequests,
} from "@/lib/queries/social";

export default function FollowRequestsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: requests,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["follow-requests", user?.id],
    queryFn: () => getIncomingFollowRequests(user!.id),
    enabled: !!user,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["follow-requests", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  const approve = useMutation({
    mutationFn: (requesterId: string) => approveFollowRequest(requesterId),
    onSuccess: refresh,
    onError: () => toast.error("Couldn't approve this request"),
  });

  const deny = useMutation({
    mutationFn: (requesterId: string) =>
      cancelFollowRequest(requesterId, user!.id),
    onSuccess: refresh,
    onError: () => toast.error("Couldn't remove this request"),
  });

  const pendingId = approve.variables ?? deny.variables;
  const isBusy = approve.isPending || deny.isPending;

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <div>
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          ◇&nbsp;&nbsp;ACTIVITY
          {requests?.length ? ` · ${requests.length} PENDING` : ""}
        </p>
        <h1 className="mt-2 text-4xl sm:text-[48px] font-bold leading-none tracking-[-0.035em] text-foreground">
          Follow <span className="text-primary">requests</span>.
        </h1>
        <p className="mt-3 text-[13px] text-muted-foreground">
          Your account is private, so these people are waiting on you before
          they can see your posts.{" "}
          <Link href="/notifications" className="text-foreground underline">
            Back to activity
          </Link>
        </p>
      </div>

      {isError ? (
        <OrbitErrorState
          headline="Couldn't load your"
          accentWord="requests"
          sub="Something went wrong fetching your follow requests."
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-3.5 rounded-xl border border-border bg-surface p-3.5"
            >
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : !requests || requests.length === 0 ? (
        <OrbitEmptyState
          icon={UserPlus}
          headline="No pending"
          accentWord="requests"
          sub="When someone asks to follow your private account, they show up here for you to approve or decline."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {requests.map((request, i) => {
            const { requester } = request;
            const rowBusy = isBusy && pendingId === requester.id;
            return (
              <div
                key={requester.id}
                className={`flex items-center gap-3.5 p-3.5 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <Link href={`/${requester.username}`} className="shrink-0">
                  <UserAvatar
                    src={requester.avatar_url}
                    fallback={requester.display_name || requester.username}
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${requester.username}`}
                    className="block truncate text-[14px] font-semibold text-foreground"
                  >
                    {requester.display_name || requester.username}
                  </Link>
                  <p className="truncate text-[12.5px] text-muted-foreground">
                    @{requester.username} · {formatTimeAgo(request.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    disabled={rowBusy}
                    onClick={() => approve.mutate(requester.id)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={rowBusy}
                    onClick={() => deny.mutate(requester.id)}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
