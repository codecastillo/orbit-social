"use client";

import { useEffect, useState } from "react";
import { Users, Calendar, ChevronDown, ChevronUp, Shield, Lock } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import {
  joinCommunity,
  leaveCommunity,
  getMyJoinRequestStatus,
  type Community,
  type CommunityMember,
} from "@/lib/queries/communities";

interface CommunityHeaderProps {
  community: Community;
  members: CommunityMember[];
  userRole: "owner" | "moderator" | "member" | null;
  onMembershipChange: () => void;
}

export function CommunityHeader({
  community,
  members,
  userRole,
  onMembershipChange,
}: CommunityHeaderProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [joining, setJoining] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [requestStatus, setRequestStatus] = useState<
    "pending" | "approved" | "rejected" | null
  >(null);

  const isMember = userRole !== null;
  const isOwner = userRole === "owner";
  const policy = community.join_policy ?? "public";

  // Realtime: live member_count + roster updates.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`community-${community.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "communities",
          filter: `id=eq.${community.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["community", community.slug] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_members",
          filter: `community_id=eq.${community.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["community", community.slug] });
          queryClient.invalidateQueries({
            queryKey: ["community-members", community.id],
          });
          queryClient.invalidateQueries({
            queryKey: ["community-membership", community.id],
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [community.id, community.slug, queryClient]);

  // If the user has a pending request, show that state.
  useEffect(() => {
    if (!user || isMember || policy !== "approval") {
      setRequestStatus(null);
      return;
    }
    let cancelled = false;
    getMyJoinRequestStatus(community.id, user.id)
      .then((s) => {
        if (!cancelled) setRequestStatus(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, community.id, isMember, policy]);
  const rules = community.rules as
    | { title: string; description: string }[]
    | null;
  const createdDate = new Date(community.created_at).toLocaleDateString(
    "en-US",
    {
      month: "short",
      year: "numeric",
    }
  );

  const handleJoinToggle = async () => {
    if (!user) {
      toast.error("Sign in to join communities");
      return;
    }
    if (isOwner) {
      toast.error("You can't leave a community you own");
      return;
    }

    setJoining(true);
    try {
      if (isMember) {
        await leaveCommunity(community.id, user.id);
        toast.success(`Left ${community.name}`);
      } else {
        const result = await joinCommunity(community.id);
        if (result === "joined") {
          toast.success(`Joined ${community.name}`);
        } else if (result === "requested") {
          setRequestStatus("pending");
          toast.success("Request sent — waiting on approval");
        } else {
          toast.error("This room is invite-only");
        }
      }
      onMembershipChange();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setJoining(false);
    }
  };

  const buttonLabel = (() => {
    if (joining) return "...";
    if (isOwner) return "Owner";
    if (isMember) return "Leave";
    if (policy === "invite") return "Invite Only";
    if (policy === "approval") {
      if (requestStatus === "pending") return "Pending approval";
      return "Request to Join";
    }
    return "Join Community";
  })();

  const buttonDisabled =
    joining ||
    isOwner ||
    (!isMember &&
      (policy === "invite" || requestStatus === "pending"));

  return (
    <div className="border-b border-border">
      {/* Cover image */}
      <div className="relative h-32 sm:h-48 w-full overflow-hidden">
        {community.cover_url ? (
          <img
            src={community.cover_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/40 via-purple-500/30 to-pink-500/20" />
        )}
      </div>

      {/* Community info */}
      <div className="px-4 pb-4">
        {/* Avatar overlapping cover */}
        <div className="-mt-8 mb-3 flex items-end justify-between">
          <div className="ring-4 ring-background rounded-full">
            {community.avatar_url ? (
              <UserAvatar
                src={community.avatar_url}
                fallback={community.name}
                size="xl"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/60 to-purple-500/60 flex items-center justify-center border-4 border-background">
                <span className="text-3xl font-bold text-white">
                  {community.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <Button
            variant={isMember ? "outline" : "default"}
            onClick={handleJoinToggle}
            disabled={buttonDisabled}
            className="mt-10"
          >
            {policy === "invite" && !isMember && !isOwner && (
              <Lock className="h-3.5 w-3.5" />
            )}
            {buttonLabel}
          </Button>
        </div>

        <h1 className="text-xl font-bold">{community.name}</h1>

        {community.description && (
          <p className="text-muted-foreground mt-1 text-sm">
            {community.description}
          </p>
        )}

        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>{formatNumber(community.member_count)} members</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>Created {createdDate}</span>
          </div>
        </div>

        {/* Members preview */}
        {members.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex -space-x-2">
              {members.slice(0, 5).map((member) => (
                <div
                  key={member.user_id}
                  className="ring-2 ring-background rounded-full"
                >
                  <UserAvatar
                    src={member.profiles.avatar_url}
                    fallback={member.profiles.display_name}
                    size="sm"
                  />
                </div>
              ))}
            </div>
            {community.member_count > 5 && (
              <span className="text-xs text-muted-foreground">
                +{formatNumber(community.member_count - 5)} more
              </span>
            )}
          </div>
        )}

        {/* Rules section */}
        {rules && rules.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setRulesOpen(!rulesOpen)}
              className={cn(
                "flex items-center gap-2 w-full text-sm font-medium",
                "text-muted-foreground hover:text-foreground transition-colors"
              )}
            >
              <Shield className="h-4 w-4" />
              <span>Community Rules ({rules.length})</span>
              {rulesOpen ? (
                <ChevronUp className="h-4 w-4 ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-auto" />
              )}
            </button>

            {rulesOpen && (
              <div className="mt-2 space-y-2">
                {rules.map((rule, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-muted/50 p-3 text-sm"
                  >
                    <p className="font-medium">
                      {i + 1}. {rule.title}
                    </p>
                    {rule.description && (
                      <p className="text-muted-foreground mt-0.5">
                        {rule.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
