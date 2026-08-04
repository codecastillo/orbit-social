"use client";

import { useState } from "react";
import { Archive, FolderPlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getArchivedStories,
  deleteStory,
  type StoryGroup,
  type StoryWithAuthor,
} from "@/lib/queries/stories";
import {
  addStoriesToHighlight,
  getHighlights,
} from "@/lib/queries/highlights";
import { StoryViewer } from "@/components/stories/story-viewer";
import { HighlightCreator } from "@/components/stories/highlight-creator";
import { ConfirmDialog } from "@/components/orbit/confirm-dialog";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const ARCHIVE_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

/**
 * Picks one archived moment into a collection: any existing highlight, or a
 * brand new one through the shared creator (which now offers archived
 * moments as well, so the moment is one tap away there).
 */
function CollectionPicker({
  story,
  userId,
  onOpenCreator,
  onClose,
}: {
  story: StoryWithAuthor;
  userId: string;
  onOpenCreator: () => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: highlights = [], isPending } = useQuery({
    queryKey: ["story-highlights", userId],
    queryFn: () => getHighlights(userId),
  });

  const handleAdd = async (highlightId: string) => {
    if (savingId) return;
    setSavingId(highlightId);
    try {
      await addStoriesToHighlight(highlightId, [story.id]);
      queryClient.invalidateQueries({ queryKey: ["story-highlights", userId] });
      toast.success("Added to collection");
      onClose();
    } catch {
      toast.error("Couldn't add to that collection");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Add to a collection</DialogTitle>
          <DialogDescription>
            Collections keep a moment on your profile past its 24 hours.
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : highlights.length === 0 ? (
          <p className="py-4 text-[13px] text-muted-foreground">
            No collections yet.
          </p>
        ) : (
          <div className="flex max-h-[280px] flex-col overflow-y-auto">
            {highlights.map((highlight) => (
              <button
                key={highlight.id}
                onClick={() => handleAdd(highlight.id)}
                disabled={savingId !== null}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-accent disabled:opacity-60"
              >
                {highlight.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={highlight.cover_url}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full border-2 border-primary object-cover"
                  />
                ) : (
                  <span className="h-9 w-9 shrink-0 rounded-full border-2 border-primary bg-surface-elevated" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {highlight.title}
                </span>
                {savingId === highlight.id && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </button>
            ))}
          </div>
        )}

        <Button variant="outline" onClick={onOpenCreator}>
          <FolderPlus className="h-4 w-4" />
          New collection
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function MomentsArchivePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StoryWithAuthor | null>(
    null,
  );
  const [addingTo, setAddingTo] = useState<StoryWithAuthor | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);

  const { data: stories = [], isPending } = useQuery({
    queryKey: ["archived-stories", user?.id],
    queryFn: () => getArchivedStories(user!.id),
    enabled: !!user,
  });

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteStory(pendingDelete.id);
      queryClient.invalidateQueries({
        queryKey: ["archived-stories", user?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["own-stories", user?.id] });
      toast.success("Moment deleted");
    } catch {
      toast.error("Couldn't delete that moment");
    }
  };

  if (!user || isPending) {
    return (
      <div className="flex flex-col gap-[18px]">
        <Skeleton className="h-[68px] rounded-xl" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[9/16] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // The viewer replays the archive as one explicit group, the same shape the
  // highlights row hands it.
  const playingGroup: StoryGroup | null =
    playingIndex !== null && stories.length > 0
      ? {
          user: stories[playingIndex].profiles,
          stories: stories.slice(playingIndex),
          hasUnviewed: false,
        }
      : null;

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <div>
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
          ◇&nbsp;&nbsp;MOMENTS · ARCHIVE · {stories.length}
        </p>
        <h1 className="mt-2 text-4xl font-bold leading-none tracking-[-0.035em] text-foreground sm:text-[48px]">
          Everything <span className="text-primary">since</span>.
        </h1>
        <p className="mt-2.5 max-w-[540px] text-[14.5px] leading-[1.55] text-muted-foreground">
          Your moments land here once their 24 hours are up. Only you can see
          this page. Keep one on your profile by adding it to a collection.
        </p>
      </div>

      {stories.length === 0 ? (
        <OrbitEmptyState
          icon={Archive}
          headline="Nothing"
          accentWord="archived"
          headlineTail="yet"
          sub="Post a moment and it'll show up here 24 hours later, kept for you alone."
        />
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {stories.map((story, index) => {
            const thumb = story.thumbnail_url ?? story.media_url;
            const posted = new Date(story.created_at).toLocaleDateString(
              undefined,
              ARCHIVE_DATE_FORMAT,
            );
            return (
              <div
                key={story.id}
                className="group relative overflow-hidden rounded-xl border border-border bg-surface"
              >
                <button
                  onClick={() => setPlayingIndex(index)}
                  aria-label={`Play moment from ${posted}`}
                  className="block w-full cursor-pointer"
                >
                  <div className="relative aspect-[9/16]">
                    {story.media_type === "video" && !story.thumbnail_url ? (
                      <video
                        src={story.media_url}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-left font-mono text-[10px] tracking-[0.06em] text-white/80">
                      {posted}
                    </span>
                  </div>
                </button>

                <div className="absolute right-1.5 top-1.5 hidden gap-1 group-hover:flex group-focus-within:flex">
                  <button
                    onClick={() => setAddingTo(story)}
                    aria-label={`Add moment from ${posted} to a collection`}
                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-border bg-surface-elevated text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPendingDelete(story)}
                    aria-label={`Delete moment from ${posted}`}
                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-border bg-surface-elevated text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {playingGroup && (
        <StoryViewer
          storyGroups={[playingGroup]}
          initialGroupIndex={0}
          onClose={() => setPlayingIndex(null)}
        />
      )}

      {addingTo && (
        <CollectionPicker
          story={addingTo}
          userId={user.id}
          onOpenCreator={() => {
            setAddingTo(null);
            setCreatorOpen(true);
          }}
          onClose={() => setAddingTo(null)}
        />
      )}

      <HighlightCreator
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        userId={user.id}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
        title="Delete this moment?"
        description="It's gone for good, including from any collection it's in."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
      />
    </div>
  );
}
