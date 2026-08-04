"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
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
  checkFollowStates,
  getFollowers,
  getFollowing,
  toggleFollowState,
  type FollowState,
  type ProfileSummary,
} from "@/lib/queries/social";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  BLOCKED_FOLLOW_MESSAGE,
  isBlockedFollowError,
} from "@/lib/utils/blocked-error";

type Kind = "followers" | "following";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  kind: Kind;
  title?: string;
}

export function FollowListDialog({ open, onOpenChange, userId, kind, title }: Props) {
  const { user } = useAuth();
  const myId = user?.id;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["follow-list", userId, kind],
    queryFn: () =>
      kind === "followers"
        ? getFollowers(userId, undefined, 50)
        : getFollowing(userId, undefined, 50),
    enabled: open,
  });

  // Fetch where I stand with each of these users so the buttons render the
  // correct initial state.
  const { data: followStates } = useQuery({
    queryKey: ["follow-list-status", myId, data?.map((p) => p.id)],
    queryFn: () => {
      if (!myId || !data || data.length === 0) {
        return new Map<string, FollowState>();
      }
      return checkFollowStates(
        myId,
        data.map((p) => p.id)
      );
    },
    enabled: open && !!myId && !!data && data.length > 0,
  });

  // Local follow state: overlays the server-side set so toggles feel instant.
  const [overrides, setOverrides] = useState<Record<string, FollowState>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const followStateOf = (id: string): FollowState =>
    overrides[id] ?? followStates?.get(id) ?? "none";

  const toggleFollow = async (target: ProfileSummary) => {
    if (!myId) {
      toast.error("Sign in to follow people");
      return;
    }
    setBusy(target.id);
    try {
      const next = await toggleFollowState(
        myId,
        target.id,
        followStateOf(target.id)
      );
      setOverrides((m) => ({ ...m, [target.id]: next }));
    } catch (err) {
      console.error("Follow toggle failed:", err);
      toast.error(
        isBlockedFollowError(err)
          ? BLOCKED_FOLLOW_MESSAGE
          : "Couldn't update follow"
      );
    } finally {
      setBusy(null);
    }
  };

  const heading = title ?? (kind === "followers" ? "Followers" : "Following");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden rounded-2xl border border-border bg-surface-elevated p-0">
        <DialogHeader className="border-b border-border px-5 pt-5 pb-3">
          <DialogTitle className="text-base tracking-wide text-foreground">
            {heading}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[480px] divide-y divide-border/50 overflow-y-auto">
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
          ) : isError ? (
            <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
              Couldn&apos;t load this list.{" "}
              <button
                onClick={() => refetch()}
                className="cursor-pointer font-semibold text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          ) : !data || data.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
              {kind === "followers"
                ? "No followers yet."
                : "Not following anyone yet."}
            </div>
          ) : (
            data.map((p: ProfileSummary) => {
              const isSelf = myId === p.id;
              const state = followStateOf(p.id);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface transition-colors"
                >
                  <Link
                    href={`/${p.username}`}
                    onClick={() => onOpenChange(false)}
                    className="contents no-underline"
                  >
                    <UserAvatar
                      src={p.avatar_url}
                      fallback={p.display_name || p.username}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <span className="truncate">
                          {p.display_name || p.username}
                        </span>
                        {p.is_verified && <VerifiedStar size={12} />}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        @{p.username}
                      </div>
                      {p.bio && (
                        <div className="mt-0.5 truncate text-xs text-text-secondary">
                          {p.bio}
                        </div>
                      )}
                    </div>
                  </Link>
                  {!isSelf && myId && (
                    <Button
                      size="sm"
                      variant={state === "none" ? "default" : "outline"}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFollow(p);
                      }}
                      disabled={busy === p.id}
                      className="shrink-0"
                    >
                      {state === "following"
                        ? "Following"
                        : state === "requested"
                          ? "Requested"
                          : "Follow"}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
