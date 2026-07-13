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
  checkFollowing,
  followUser,
  getFollowers,
  getFollowing,
  unfollowUser,
  type ProfileSummary,
} from "@/lib/queries/social";
import { useAuth } from "@/lib/hooks/use-auth";

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

  const { data, isLoading } = useQuery({
    queryKey: ["follow-list", userId, kind],
    queryFn: () =>
      kind === "followers"
        ? getFollowers(userId, undefined, 50)
        : getFollowing(userId, undefined, 50),
    enabled: open,
  });

  // Fetch which of these users I'm following so the buttons render the
  // correct initial state.
  const { data: followingSet } = useQuery({
    queryKey: ["follow-list-status", myId, data?.map((p) => p.id)],
    queryFn: () => {
      if (!myId || !data || data.length === 0) return new Set<string>();
      return checkFollowing(
        myId,
        data.map((p) => p.id)
      );
    },
    enabled: open && !!myId && !!data && data.length > 0,
  });

  // Local follow state: overlays the server-side set so toggles feel instant.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const isFollowing = (id: string): boolean => {
    if (overrides[id] !== undefined) return overrides[id];
    return followingSet?.has(id) ?? false;
  };

  const toggleFollow = async (target: ProfileSummary) => {
    if (!myId) {
      toast.error("Sign in to follow people");
      return;
    }
    const currently = isFollowing(target.id);
    setBusy(target.id);
    setOverrides((m) => ({ ...m, [target.id]: !currently }));
    try {
      if (currently) {
        await unfollowUser(myId, target.id);
      } else {
        await followUser(myId, target.id);
      }
    } catch (err) {
      console.error("Follow toggle failed:", err);
      toast.error("Couldn't update follow");
      setOverrides((m) => ({ ...m, [target.id]: currently }));
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
          ) : !data || data.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
              {kind === "followers"
                ? "No followers yet."
                : "Not following anyone yet."}
            </div>
          ) : (
            data.map((p: ProfileSummary) => {
              const isSelf = myId === p.id;
              const following = isFollowing(p.id);
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
                      variant={following ? "outline" : "default"}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFollow(p);
                      }}
                      disabled={busy === p.id}
                      className="shrink-0"
                    >
                      {following ? "Following" : "Follow"}
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
