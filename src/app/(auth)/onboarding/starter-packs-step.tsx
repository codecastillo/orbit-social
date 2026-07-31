"use client";

import { useState } from "react";
import { ArrowRight, Check, ChevronDown, Plus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  followPackMembers,
  type StarterPack,
} from "@/lib/queries/starter-packs";

/**
 * Final onboarding step: curated starter packs the user can follow in one
 * tap. One-click graph bootstrap drove up to 43% of follows on Bluesky, so
 * this is the highest-leverage moment to fill an empty feed.
 */
export function StarterPacksStep({
  packs,
  userId,
  onFinish,
}: {
  packs: StarterPack[];
  userId: string;
  onFinish: () => void;
}) {
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const followableIds = (pack: StarterPack) =>
    pack.members.map((m) => m.id).filter((id) => id !== userId);

  const followMembers = async (ids: string[]) => {
    const missing = ids.filter((id) => !followed.has(id));
    if (missing.length === 0) return;
    // Optimistic: flip the buttons now, roll back if the insert fails.
    setFollowed((prev) => new Set([...prev, ...missing]));
    try {
      await followPackMembers(userId, missing);
    } catch {
      setFollowed((prev) => {
        const next = new Set(prev);
        missing.forEach((id) => next.delete(id));
        return next;
      });
      toast.error("Couldn't follow right now. Try again.");
    }
  };

  const toggleExpanded = (packId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) next.delete(packId);
      else next.add(packId);
      return next;
    });
  };

  const totalFollowed = followed.size;

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-6 pt-5">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
          Starter packs
        </p>
        <h1 className="mt-2.5 text-[32px] font-bold leading-tight tracking-[-0.03em] text-foreground">
          Fill your feed <span className="text-primary">instantly</span>.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Hand-picked groups of people worth following. Grab a whole pack, or
          open one and pick individually.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-auto px-4 py-[18px]">
        {packs.map((pack) => {
          const ids = followableIds(pack);
          const allFollowed =
            ids.length > 0 && ids.every((id) => followed.has(id));
          const isOpen = expanded.has(pack.id);
          return (
            <div
              key={pack.id}
              className="rounded-xl border border-border bg-surface"
            >
              <div className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">
                    {pack.title}
                  </div>
                  {pack.description && (
                    <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                      {pack.description}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(pack.id)}
                    className="mt-2.5 flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-muted-foreground hover:text-foreground"
                  >
                    <span className="flex -space-x-2">
                      {pack.members.slice(0, 3).map((m) => (
                        <span
                          key={m.id}
                          className="rounded-full ring-2 ring-surface"
                        >
                          <UserAvatar
                            src={m.avatar_url}
                            fallback={m.display_name}
                            size="sm"
                          />
                        </span>
                      ))}
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                      <UsersRound className="h-3 w-3" strokeWidth={2} />
                      {pack.members.length}{" "}
                      {pack.members.length === 1 ? "person" : "people"}
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          isOpen && "rotate-180",
                        )}
                        strokeWidth={2}
                      />
                    </span>
                  </button>
                </div>
                <Button
                  size="sm"
                  variant={allFollowed ? "outline" : "default"}
                  disabled={ids.length === 0}
                  onClick={() => followMembers(ids)}
                >
                  {allFollowed ? (
                    <>
                      <Check className="h-3 w-3" strokeWidth={3} /> Following
                    </>
                  ) : (
                    "Follow all"
                  )}
                </Button>
              </div>

              {isOpen && (
                <div className="border-t border-border px-4">
                  {pack.members.map((m) => {
                    const isSelf = m.id === userId;
                    const isOn = followed.has(m.id);
                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
                      >
                        <UserAvatar
                          src={m.avatar_url}
                          fallback={m.display_name}
                          size="md"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {m.display_name}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            @{m.username}
                          </div>
                        </div>
                        {!isSelf && (
                          <Button
                            size="sm"
                            variant={isOn ? "outline" : "default"}
                            onClick={() => followMembers([m.id])}
                          >
                            {isOn ? (
                              <>
                                <Check className="h-3 w-3" strokeWidth={3} />{" "}
                                Added
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3" strokeWidth={2.4} />{" "}
                                Add
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-border px-[22px] pb-7 pt-[18px]">
        <div className="mb-3 text-center text-xs text-muted-foreground">
          {totalFollowed > 0
            ? `${totalFollowed} followed from packs`
            : "Optional · you can skip this"}
        </div>
        <Button className="h-11 w-full text-sm" onClick={onFinish}>
          Enter Orbit <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
