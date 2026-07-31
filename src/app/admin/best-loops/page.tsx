"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  Repeat,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatNumber } from "@/lib/utils/format";
import {
  addCuratedClip,
  getClipById,
  getCuratedWeekAdmin,
  isoWeekMonday,
  removeCuratedClip,
  reorderCuratedClips,
  searchReels,
} from "@/lib/queries/clips";
import type { PostWithAuthor } from "@/lib/queries/posts";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const DAY_MS = 24 * 60 * 60 * 1000;

function shiftWeek(weekStart: string, weeks: number): string {
  return isoWeekMonday(new Date(Date.parse(weekStart) + weeks * 7 * DAY_MS));
}

function formatWeekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminBestLoopsPage() {
  const queryClient = useQueryClient();
  const [week, setWeek] = useState(() => isoWeekMonday());

  const weekKey = ["admin-best-loops", week];

  const { data: curated, isLoading, isError, refetch } = useQuery({
    queryKey: weekKey,
    queryFn: () => getCuratedWeekAdmin(week),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: weekKey });
    // The public feed pins this list; keep it fresh after edits.
    queryClient.invalidateQueries({ queryKey: ["best-loops"] });
  };

  const removeMutation = useMutation({
    mutationFn: (postId: string) => removeCuratedClip(week, postId),
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: (postIds: string[]) => reorderCuratedClips(week, postIds),
    onSuccess: invalidate,
  });

  const moveClip = (index: number, direction: -1 | 1) => {
    if (!curated) return;
    const ids = curated.map((c) => c.post.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Best Loops</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Weekly hand-picked clips pinned at the top of the clips feed
        </p>
      </div>

      {/* Week picker */}
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setWeek((w) => shiftWeek(w, -1))}
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center">
          <div className="text-sm font-semibold">
            Week of {formatWeekLabel(week)}
          </div>
          {week === isoWeekMonday() && (
            <div className="text-xs text-muted-foreground">Current week</div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setWeek((w) => shiftWeek(w, 1))}
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <ClipPicker
        week={week}
        curatedIds={new Set((curated ?? []).map((c) => c.post.id))}
        nextSortOrder={curated?.length ?? 0}
        onChanged={invalidate}
      />

      {/* Curated list for the selected week */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          Couldn&apos;t load this week&apos;s picks.{" "}
          <button
            onClick={() => refetch()}
            className="cursor-pointer font-semibold text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      ) : curated && curated.length > 0 ? (
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          {curated.map((entry, idx) => (
            <div
              key={entry.post.id}
              className={cn(
                "flex items-center gap-3 bg-surface p-2.5",
                idx !== 0 && "border-t border-foreground/5",
              )}
            >
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={idx === 0 || reorderMutation.isPending}
                  onClick={() => moveClip(idx, -1)}
                  aria-label="Move clip up"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={
                    idx === curated.length - 1 || reorderMutation.isPending
                  }
                  onClick={() => moveClip(idx, 1)}
                  aria-label="Move clip down"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              <ClipSummary clip={entry.post} />
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(entry.post.id)}
                aria-label="Remove clip"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Repeat}
          title="No picks for this week"
          description="Search reels above or paste a clip URL to start curating."
        />
      )}
    </div>
  );
}

/** Thumbnail + caption + author + loop count, shared by list and picker. */
function ClipSummary({ clip }: { clip: PostWithAuthor }) {
  const media = clip.post_media?.[0];
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="h-14 w-9 shrink-0 overflow-hidden rounded-md bg-black">
        {media?.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- tiny admin thumbnail, no optimization pipeline needed
          <img
            src={media.thumbnail_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <Repeat className="h-3.5 w-3.5 text-white/40" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {clip.content || "Untitled clip"}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserAvatar
            src={clip.profiles.avatar_url}
            fallback={clip.profiles.display_name || clip.profiles.username}
            size="sm"
          />
          <span className="truncate">@{clip.profiles.username}</span>
          <span className="shrink-0 tabular-nums">
            {formatNumber(clip.loop_count ?? 0)} loops
          </span>
        </div>
      </div>
    </div>
  );
}

function ClipPicker({
  week,
  curatedIds,
  nextSortOrder,
  onChanged,
}: {
  week: string;
  curatedIds: Set<string>;
  nextSortOrder: number;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // A pasted clip URL (or bare id) resolves directly; anything else runs
  // a caption search restricted to reels.
  const pastedId = UUID_RE.exec(debouncedQuery)?.[0]?.toLowerCase() ?? null;

  const { data: results } = useQuery({
    queryKey: ["admin-best-loops-search", debouncedQuery],
    queryFn: async (): Promise<PostWithAuthor[]> => {
      if (pastedId) {
        try {
          return [await getClipById(pastedId)];
        } catch {
          return []; // not a reel or not found; show no candidates
        }
      }
      return searchReels(debouncedQuery, 8);
    },
    enabled: debouncedQuery.trim().length > 0,
  });

  const addMutation = useMutation({
    mutationFn: (postId: string) => addCuratedClip(week, postId, nextSortOrder),
    onSuccess: () => {
      setQuery("");
      onChanged();
    },
  });

  const candidates = (results ?? []).filter((c) => !curatedIds.has(c.id));

  return (
    <div className="mb-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reel captions or paste a clip URL..."
          className="pl-9"
        />
      </div>

      {candidates.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-lg ring-1 ring-foreground/10">
          {candidates.map((clip, idx) => (
            <div
              key={clip.id}
              className={cn(
                "flex items-center gap-3 bg-surface p-2.5",
                idx !== 0 && "border-t border-foreground/5",
              )}
            >
              <ClipSummary clip={clip} />
              <Button
                variant="outline"
                size="sm"
                disabled={addMutation.isPending}
                onClick={() => addMutation.mutate(clip.id)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
