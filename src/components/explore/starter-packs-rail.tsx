"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  followPackMembers,
  getActiveStarterPacks,
  getFollowedMemberIds,
  type StarterPack,
} from "@/lib/queries/starter-packs";

const AVATARS_SHOWN = 4;

/**
 * Curated follow bundles, the same ones onboarding offers, kept reachable
 * after onboarding for people who skipped them or joined before they
 * existed. A pack disappears once the viewer follows everyone in it.
 */
export function StarterPacksRail() {
  const { user } = useAuth();

  // Returns [] on any error, so a missing table just hides the rail.
  const { data: packs } = useQuery({
    queryKey: ["starter-packs-active"],
    queryFn: getActiveStarterPacks,
    staleTime: 1000 * 60 * 10,
  });

  const memberIds = [
    ...new Set((packs ?? []).flatMap((p) => p.members.map((m) => m.id))),
  ];

  const {
    data: alreadyFollowing,
    isPending: followsPending,
    isError: followsError,
  } = useQuery({
    queryKey: ["starter-pack-follows", user?.id, memberIds.length],
    queryFn: () => getFollowedMemberIds(user!.id, memberIds),
    enabled: !!user?.id && memberIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const [followed, setFollowed] = useState<Set<string>>(new Set());
  // Private members only get a request, so they are resolved for the purpose
  // of hiding the card but must never be counted as follows.
  const [requested, setRequested] = useState<Set<string>>(new Set());

  if (!user || !packs || packs.length === 0) return null;
  // The follow graph decides which packs still have something to offer, so
  // without it the rail stays hidden rather than pitching stale packs.
  if (memberIds.length > 0 && (followsPending || followsError)) return null;

  const isResolved = (id: string) =>
    followed.has(id) || requested.has(id) || (alreadyFollowing?.has(id) ?? false);

  const remaining = (pack: StarterPack) =>
    pack.members
      .map((m) => m.id)
      .filter((id) => id !== user.id && !isResolved(id));

  const openPacks = packs.filter((pack) => remaining(pack).length > 0);
  if (openPacks.length === 0) return null;

  const followAll = async (pack: StarterPack) => {
    const ids = remaining(pack);
    if (ids.length === 0) return;
    try {
      const result = await followPackMembers(user.id, ids);
      setFollowed((prev) => new Set([...prev, ...result.followed]));
      setRequested((prev) => new Set([...prev, ...result.requested]));
      toast.success(
        result.requested.length > 0
          ? `Following ${result.followed.length} from ${pack.title}, ${result.requested.length} pending approval`
          : `Following ${pack.title}`,
      );
    } catch {
      toast.error("Couldn't follow right now. Try again.");
    }
  };

  return (
    <div>
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        ◈&nbsp;&nbsp;STARTER PACKS
      </p>
      <div className="mt-3.5 flex gap-3 overflow-x-auto pb-1">
        {openPacks.map((pack) => (
          <div
            key={pack.id}
            className="flex w-[260px] shrink-0 flex-col rounded-xl border border-border bg-surface p-4"
          >
            <div className="text-sm font-semibold text-foreground">
              {pack.title}
            </div>
            {pack.description && (
              <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-text-secondary">
                {pack.description}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className="flex -space-x-2">
                {pack.members.slice(0, AVATARS_SHOWN).map((m) => (
                  <span key={m.id} className="rounded-full ring-2 ring-surface">
                    <UserAvatar
                      src={m.avatar_url}
                      fallback={m.display_name}
                      size="sm"
                    />
                  </span>
                ))}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <UsersRound className="h-3 w-3" strokeWidth={2} />
                {pack.members.length}
              </span>
            </div>
            <Button
              size="sm"
              className="mt-3.5 w-full"
              onClick={() => followAll(pack)}
            >
              Follow all
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
