"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Loader2, ShieldOff, Shield, UserMinus } from "lucide-react";
import { toast } from "sonner";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { VerifiedStar } from "@/components/orbit/verified-star";
import {
  getCommunityMembers,
  removeCommunityMember,
  setCommunityMemberRole,
} from "@/lib/queries/communities";
import { O } from "@/lib/design/orbit";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  /** When true, owner-only management actions are shown next to each
      non-owner member (kick, promote, demote). */
  isOwner?: boolean;
  /** Caller's user_id, used to hide the actions menu on the owner's
      own row so the owner can't remove themselves accidentally. */
  currentUserId?: string;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "OWNER",
  moderator: "MOD",
  member: "MEMBER",
};

export function CommunityMembersDialog({
  open,
  onOpenChange,
  communityId,
  isOwner = false,
  currentUserId,
}: Props) {
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
                  communityId={communityId}
                  isOwner={isOwner}
                  currentUserId={currentUserId}
                />
              )}
              {mods.length > 0 && (
                <Section
                  label={`MODERATORS · ${mods.length}`}
                  items={mods}
                  onClose={() => onOpenChange(false)}
                  communityId={communityId}
                  isOwner={isOwner}
                  currentUserId={currentUserId}
                />
              )}
              {members.length > 0 && (
                <Section
                  label={`MEMBERS · ${members.length}`}
                  items={members}
                  onClose={() => onOpenChange(false)}
                  communityId={communityId}
                  isOwner={isOwner}
                  currentUserId={currentUserId}
                />
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MemberItem {
  user_id: string;
  role: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

function Section({
  label,
  items,
  onClose,
  communityId,
  isOwner,
  currentUserId,
}: {
  label: string;
  items: MemberItem[];
  onClose: () => void;
  communityId: string;
  isOwner: boolean;
  currentUserId?: string;
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
        <MemberRow
          key={m.user_id}
          member={m}
          onClose={onClose}
          communityId={communityId}
          isOwner={isOwner}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}

function MemberRow({
  member,
  onClose,
  communityId,
  isOwner,
  currentUserId,
}: {
  member: MemberItem;
  onClose: () => void;
  communityId: string;
  isOwner: boolean;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  // Show the management menu when the caller is the room owner AND the
  // target row is not the owner themselves and not another owner.
  const showMenu =
    isOwner &&
    member.user_id !== currentUserId &&
    member.role !== "owner";

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ["community-members-full", communityId],
    });
    queryClient.invalidateQueries({
      queryKey: ["community-members", communityId],
    });
    queryClient.invalidateQueries({
      queryKey: ["community", communityId],
    });
  };

  const handleRemove = async () => {
    if (busy) return;
    if (!window.confirm(`Remove @${member.profiles.username} from this room?`))
      return;
    setBusy(true);
    try {
      await removeCommunityMember(communityId, member.user_id);
      toast.success(`Removed @${member.profiles.username}`);
      refresh();
    } catch (e) {
      console.error("removeCommunityMember failed", e);
      toast.error("Couldn't remove member");
    } finally {
      setBusy(false);
    }
  };

  const handleSetRole = async (role: "moderator" | "member") => {
    if (busy) return;
    setBusy(true);
    try {
      await setCommunityMemberRole(communityId, member.user_id, role);
      toast.success(
        role === "moderator"
          ? `@${member.profiles.username} is now a moderator`
          : `@${member.profiles.username} is now a member`,
      );
      refresh();
    } catch (e) {
      console.error("setCommunityMemberRole failed", e);
      toast.error("Couldn't update role");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors">
      <Link
        href={`/${member.profiles.username}`}
        onClick={onClose}
        style={{
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: 1,
          minWidth: 0,
        }}
      >
        <UserAvatar
          src={member.profiles.avatar_url}
          fallback={member.profiles.display_name || member.profiles.username}
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
              {member.profiles.display_name || member.profiles.username}
            </span>
            {member.profiles.is_verified && <VerifiedStar size={12} />}
          </div>
          <div style={{ fontSize: 12, color: O.ink3 }}>
            @{member.profiles.username}
          </div>
        </div>
      </Link>

      {member.role !== "member" && (
        <span
          style={{
            fontSize: 10,
            fontFamily: O.mono,
            letterSpacing: "0.1em",
            color: member.role === "owner" ? "#ffd76a" : O.a3,
            border: `1px solid ${member.role === "owner" ? "#ffd76a55" : `color-mix(in oklab, ${O.a3} 33%, transparent)`}`,
            padding: "3px 8px",
            borderRadius: 99,
          }}
        >
          {ROLE_LABEL[member.role] ?? member.role.toUpperCase()}
        </span>
      )}

      {showMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={busy}
            aria-label={`Manage @${member.profiles.username}`}
            className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-2xl">
            {member.role === "moderator" ? (
              <DropdownMenuItem
                className="cursor-pointer rounded-lg"
                onClick={() => handleSetRole("member")}
              >
                <ShieldOff className="mr-2 h-4 w-4" />
                Demote to member
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="cursor-pointer rounded-lg"
                onClick={() => handleSetRole("moderator")}
              >
                <Shield className="mr-2 h-4 w-4" />
                Promote to moderator
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer rounded-lg"
              onClick={handleRemove}
            >
              <UserMinus className="mr-2 h-4 w-4" />
              Remove from room
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
