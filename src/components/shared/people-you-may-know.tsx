"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getCombinedSuggestions,
  followUser,
  unfollowUser,
  type ProfileSummary,
} from "@/lib/queries/social";

interface SuggestionCardProps {
  profile: ProfileSummary & { mutualCount?: number };
}

function SuggestionCard({ profile }: SuggestionCardProps) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);

  const handleToggle = async () => {
    if (!user) {
      toast.error("Sign in to follow people");
      return;
    }
    const was = isFollowing;
    setIsFollowing(!was);
    try {
      if (was) {
        await unfollowUser(user.id, profile.id);
      } else {
        await followUser(user.id, profile.id);
      }
    } catch {
      setIsFollowing(was);
      toast.error("Something went wrong");
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 min-w-[140px] max-w-[140px] p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] shrink-0">
      <Link href={`/${profile.username}`}>
        <UserAvatar
          src={profile.avatar_url}
          fallback={profile.display_name}
          size="lg"
        />
      </Link>
      <div className="text-center min-w-0 w-full">
        <Link href={`/${profile.username}`}>
          <p className="text-sm font-semibold truncate hover:underline">
            {profile.display_name}
          </p>
        </Link>
        <p className="text-[11px] text-muted-foreground truncate">
          @{profile.username}
        </p>
        {profile.mutualCount !== undefined && profile.mutualCount > 0 && (
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
            {profile.mutualCount} mutual{profile.mutualCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>
      <FollowButton
        isFollowing={isFollowing}
        onToggle={handleToggle}
        size="sm"
        className="w-full"
      />
    </div>
  );
}

export function PeopleYouMayKnow() {
  const { user } = useAuth();

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["combined-suggestions", user?.id],
    queryFn: () => getCombinedSuggestions(user!.id, 12),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  if (!user) return null;
  if (!isLoading && (!suggestions || suggestions.length === 0)) return null;

  return (
    <div className="py-4">
      <div className="flex items-center justify-between px-4 mb-3">
        <h3 className="text-sm font-semibold text-zinc-300">
          People you may know
        </h3>
        <Link
          href="/explore"
          className="flex items-center gap-0.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          See All
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex gap-3 px-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 min-w-[140px] p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]"
            >
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide pb-1">
          {suggestions!.map((profile) => (
            <SuggestionCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </div>
  );
}
