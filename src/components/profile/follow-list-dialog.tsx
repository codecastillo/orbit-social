"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { VerifiedStar } from "@/components/orbit/verified-star";
import {
  getFollowers,
  getFollowing,
  type ProfileSummary,
} from "@/lib/queries/social";
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
  const { data, isLoading } = useQuery({
    queryKey: ["follow-list", userId, kind],
    queryFn: () =>
      kind === "followers" ? getFollowers(userId, undefined, 50) : getFollowing(userId, undefined, 50),
    enabled: open,
  });

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
            data.map((p: ProfileSummary) => (
              <Link
                key={p.id}
                href={`/${p.username}`}
                onClick={() => onOpenChange(false)}
                style={{ textDecoration: "none" }}
                className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors"
              >
                <UserAvatar src={p.avatar_url} fallback={p.display_name || p.username} size="md" />
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
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.display_name || p.username}
                    </span>
                    {p.is_verified && <VerifiedStar size={12} />}
                  </div>
                  <div style={{ fontSize: 12, color: O.ink3 }}>@{p.username}</div>
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
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
