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
import { getCommunityMembers } from "@/lib/queries/communities";
import { O } from "@/lib/design/orbit";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "OWNER",
  moderator: "MOD",
  member: "MEMBER",
};

export function CommunityMembersDialog({ open, onOpenChange, communityId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["community-members-full", communityId],
    queryFn: () => getCommunityMembers(communityId, 200),
    enabled: open,
  });

  const owners = (data ?? []).filter((m) => m.role === "owner");
  const mods = (data ?? []).filter((m) => m.role === "moderator");
  const members = (data ?? []).filter(
    (m) => m.role !== "owner" && m.role !== "moderator"
  );

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
            Members
          </DialogTitle>
        </DialogHeader>
        <div
          style={{ maxHeight: 520, overflowY: "auto" }}
          className="divide-y divide-white/5"
        >
          {isLoading ? (
            <div className="p-4 flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
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
              Nobody&apos;s here yet.
            </div>
          ) : (
            <>
              {owners.length > 0 && (
                <Section
                  label={`OWNER · ${owners.length}`}
                  items={owners}
                  onClose={() => onOpenChange(false)}
                />
              )}
              {mods.length > 0 && (
                <Section
                  label={`MODERATORS · ${mods.length}`}
                  items={mods}
                  onClose={() => onOpenChange(false)}
                />
              )}
              {members.length > 0 && (
                <Section
                  label={`MEMBERS · ${members.length}`}
                  items={members}
                  onClose={() => onOpenChange(false)}
                />
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  label,
  items,
  onClose,
}: {
  label: string;
  items: Array<{
    user_id: string;
    role: string;
    profiles: {
      username: string;
      display_name: string;
      avatar_url: string | null;
      is_verified: boolean;
    };
  }>;
  onClose: () => void;
}) {
  return (
    <div>
      <div
        style={{
          padding: "10px 20px 6px",
          fontSize: 10,
          letterSpacing: "0.14em",
          color: O.ink3,
          fontFamily: O.mono,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      {items.map((m) => (
        <Link
          key={m.user_id}
          href={`/${m.profiles.username}`}
          onClick={onClose}
          style={{ textDecoration: "none" }}
          className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors"
        >
          <UserAvatar
            src={m.profiles.avatar_url}
            fallback={m.profiles.display_name || m.profiles.username}
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
                {m.profiles.display_name || m.profiles.username}
              </span>
              {m.profiles.is_verified && <VerifiedStar size={12} />}
            </div>
            <div style={{ fontSize: 12, color: O.ink3 }}>
              @{m.profiles.username}
            </div>
          </div>
          {m.role !== "member" && (
            <span
              style={{
                fontSize: 10,
                fontFamily: O.mono,
                letterSpacing: "0.1em",
                color: m.role === "owner" ? "#ffd76a" : O.a3,
                border: `1px solid ${m.role === "owner" ? "#ffd76a55" : `${O.a3}55`}`,
                padding: "3px 8px",
                borderRadius: 99,
              }}
            >
              {ROLE_LABEL[m.role] ?? m.role.toUpperCase()}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
