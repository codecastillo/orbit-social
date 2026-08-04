"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, UserMinus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/orbit/confirm-dialog";
import {
  REMOVE_FOLLOWER_DESCRIPTION,
  removeFollowerTitle,
} from "@/components/profile/remove-follower-copy";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { VerifiedStar } from "@/components/orbit/verified-star";
import {
  checkFollowStates,
  getFollowers,
  getFollowing,
  removeFollower,
  toggleFollowState,
  FOLLOWER_INVALIDATION_KEYS,
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
  const queryClient = useQueryClient();
  const [removeTarget, setRemoveTarget] = useState<ProfileSummary | null>(null);
  const canRemoveFollowers = kind === "followers" && !!myId && myId === userId;
  const listKey = ["follow-list", userId, kind];

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

  const handleRemoveFollower = async (profile: ProfileSummary) => {
    const previous = queryClient.getQueryData<ProfileSummary[]>(listKey);
    queryClient.setQueryData<ProfileSummary[]>(listKey, (list) =>
      list?.filter((p) => p.id !== profile.id)
    );
    try {
      await removeFollower(profile.id);
      // The follow triggers maintain follower_count, so the counts behind
      // these keys shift with the row.
      for (const queryKey of FOLLOWER_INVALIDATION_KEYS) {
        queryClient.invalidateQueries({ queryKey });
      }
      toast.success(`Removed @${profile.username}`);
    } catch (err) {
      console.error("removeFollower failed", err);
      queryClient.setQueryData(listKey, previous);
      toast.error(`Couldn't remove @${profile.username}`);
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
                  {canRemoveFollowers && !isSelf && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`More options for @${p.username}`}
                        className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 rounded-2xl">
                        <DropdownMenuItem
                          className="cursor-pointer rounded-lg text-destructive focus:text-destructive"
                          onClick={() => setRemoveTarget(p)}
                        >
                          <UserMinus className="mr-2 h-4 w-4" />
                          Remove follower
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>

      {removeTarget && (
        <ConfirmDialog
          open
          onOpenChange={(value) => {
            if (!value) setRemoveTarget(null);
          }}
          title={removeFollowerTitle(removeTarget.username)}
          description={REMOVE_FOLLOWER_DESCRIPTION}
          confirmLabel="Remove"
          danger
          onConfirm={() => handleRemoveFollower(removeTarget)}
        />
      )}
    </Dialog>
  );
}
