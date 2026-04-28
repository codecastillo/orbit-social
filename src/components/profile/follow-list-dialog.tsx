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
import { O } from "@/lib/design/orbit";

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

  // Local follow state — overlays the server-side set so toggles feel instant.
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

  const heading = title ?? (kind === "followers" ? "Orbit" : "Mutuals");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden border border-white/10"
        style={{ background: O.bg }}
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/10">
          <DialogTitle
            style={{
              fontFamily: O.sans,
              color: O.ink,
              fontSize: 16,
              letterSpacing: "0.02em",
            }}
          >
            {heading}
          </DialogTitle>
        </DialogHeader>
        <div
          style={{ maxHeight: 480, overflowY: "auto" }}
          className="divide-y divide-white/5"
        >
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
            <div
              style={{
                color: O.ink3,
                padding: "32px 20px",
                textAlign: "center",
                fontSize: 13,
              }}
            >
              {kind === "followers"
                ? "No one is in their orbit yet."
                : "Not following anyone yet."}
            </div>
          ) : (
            data.map((p: ProfileSummary) => {
              const isSelf = myId === p.id;
              const following = isFollowing(p.id);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors"
                >
                  <Link
                    href={`/${p.username}`}
                    onClick={() => onOpenChange(false)}
                    style={{ textDecoration: "none", display: "contents" }}
                  >
                    <UserAvatar
                      src={p.avatar_url}
                      fallback={p.display_name || p.username}
                      size="md"
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          color: O.ink,
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.display_name || p.username}
                        </span>
                        {p.is_verified && <VerifiedStar size={12} />}
                      </div>
                      <div style={{ fontSize: 12, color: O.ink3 }}>
                        @{p.username}
                      </div>
                      {p.bio && (
                        <div
                          style={{
                            fontSize: 12,
                            color: O.ink2,
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
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
