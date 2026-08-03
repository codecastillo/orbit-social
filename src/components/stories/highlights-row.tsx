"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/orbit/confirm-dialog";
import {
  deleteHighlight,
  getHighlights,
  type HighlightWithStories,
} from "@/lib/queries/highlights";
import type { StoryGroup } from "@/lib/queries/stories";
import { StoryViewer } from "./story-viewer";
import { HighlightCreator } from "./highlight-creator";

const RING_SIZE = 72;

/**
 * Orbit's satellite-dot ring from the stories bar, sized for the profile
 * highlights strip: a violet circular ring with the small filled satellite
 * sitting at roughly 1-2 o'clock.
 */
function HighlightRing({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative rounded-full border-2 border-primary p-[3px]"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      {children}
      <span className="absolute right-0 top-0 h-3 w-3 rounded-full bg-primary" />
    </div>
  );
}

/**
 * Row of story highlight circles under the profile header. Renders nothing
 * for visitors when the profile has no highlights; the owner always sees at
 * least the New tile. Tapping a highlight replays its moments in the
 * existing StoryViewer with a single explicit group.
 */
export function HighlightsRow({
  userId,
  isOwner,
}: {
  userId: string;
  isOwner: boolean;
}) {
  const queryClient = useQueryClient();
  const [playing, setPlaying] = useState<HighlightWithStories | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [pendingDelete, setPendingDelete] =
    useState<HighlightWithStories | null>(null);

  const { data: highlights = [] } = useQuery({
    queryKey: ["story-highlights", userId],
    queryFn: () => getHighlights(userId),
    staleTime: 1000 * 60 * 2,
  });

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteHighlight(pendingDelete.id);
      queryClient.invalidateQueries({ queryKey: ["story-highlights", userId] });
      toast.success("Highlight deleted");
    } catch {
      toast.error("Couldn't delete highlight");
    }
  };

  if (highlights.length === 0 && !isOwner) return null;

  const playingGroup: StoryGroup | null =
    playing && playing.stories.length > 0
      ? {
          user: playing.stories[0].profiles,
          stories: playing.stories,
          hasUnviewed: false,
        }
      : null;

  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4">
      <div className="mb-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
        ◇&nbsp;&nbsp;HIGHLIGHTS
      </div>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide">
        {isOwner && (
          <button
            onClick={() => setCreatorOpen(true)}
            className="flex shrink-0 cursor-pointer flex-col items-center gap-1.5"
          >
            <div
              className="flex items-center justify-center rounded-full border-2 border-dashed border-border bg-surface-elevated text-muted-foreground"
              style={{ width: RING_SIZE, height: RING_SIZE }}
            >
              <Plus className="h-5 w-5" />
            </div>
            <span className="w-[72px] truncate text-center text-[11px] text-muted-foreground">
              New
            </span>
          </button>
        )}

        {highlights.map((h) => (
          <div key={h.id} className="group relative shrink-0">
            <button
              onClick={() => setPlaying(h)}
              className="flex cursor-pointer flex-col items-center gap-1.5"
            >
              <HighlightRing>
                {h.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={h.cover_url}
                    alt={h.title}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full rounded-full bg-surface-elevated" />
                )}
              </HighlightRing>
              <span className="w-[72px] truncate text-center text-[11px] text-foreground">
                {h.title}
              </span>
            </button>
            {isOwner && (
              <button
                onClick={() => setPendingDelete(h)}
                aria-label={`Delete highlight ${h.title}`}
                className="absolute -right-1 -top-1 z-[1] hidden h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-border bg-surface-elevated text-muted-foreground hover:text-foreground group-hover:flex"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {playingGroup && (
        <StoryViewer
          storyGroups={[playingGroup]}
          initialGroupIndex={0}
          onClose={() => setPlaying(null)}
        />
      )}

      {isOwner && (
        <HighlightCreator
          open={creatorOpen}
          onOpenChange={setCreatorOpen}
          userId={userId}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
        title="Delete this highlight?"
        description="The moments in it are not deleted."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
      />
    </div>
  );
}
