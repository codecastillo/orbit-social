"use client";

import { useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  joinCommunity,
  leaveCommunity,
  type Community,
} from "@/lib/queries/communities";

interface CommunityCardProps {
  community: Community;
  isMember?: boolean;
  onMembershipChange?: () => void;
}

export function CommunityCard({
  community,
  isMember = false,
  onMembershipChange,
}: CommunityCardProps) {
  const { user } = useAuth();
  const [joining, setJoining] = useState(false);
  const [memberState, setMemberState] = useState(isMember);

  const handleJoinToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Sign in to join communities");
      return;
    }

    setJoining(true);
    try {
      if (memberState) {
        await leaveCommunity(community.id, user.id);
        setMemberState(false);
        toast.success(`Left ${community.name}`);
      } else {
        await joinCommunity(community.id, user.id);
        setMemberState(true);
        toast.success(`Joined ${community.name}`);
      }
      onMembershipChange?.();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setJoining(false);
    }
  };

  return (
    <Link href={`/communities/${community.slug}`} className="block group">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border/50",
          "bg-card/50 backdrop-blur-sm",
          "p-4 transition-all duration-200",
          "hover:bg-card/80 hover:border-border hover:shadow-lg hover:shadow-primary/5",
          "group-focus-visible:ring-2 group-focus-visible:ring-primary"
        )}
      >
        <div className="flex items-start gap-3">
          {community.avatar_url ? (
            <UserAvatar
              src={community.avatar_url}
              fallback={community.name}
              size="lg"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary/60 to-purple-500/60 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-white">
                {community.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {community.name}
            </h3>
            {community.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                {community.description}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{formatNumber(community.member_count)} members</span>
            </div>
          </div>

          <Button
            variant={memberState ? "outline" : "default"}
            size="sm"
            onClick={handleJoinToggle}
            disabled={joining}
            className="shrink-0"
          >
            {joining ? "..." : memberState ? "Joined" : "Join"}
          </Button>
        </div>
      </div>
    </Link>
  );
}
