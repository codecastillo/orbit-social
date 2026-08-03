"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createHighlight,
  getOwnActiveStories,
} from "@/lib/queries/highlights";

const MAX_TITLE_LENGTH = 40;
const MAX_STORIES_PER_HIGHLIGHT = 20;

/**
 * Owner-only dialog that assembles a highlight from ACTIVE moments. The
 * stories SELECT policy hides expired rows even from their author, so there
 * is no archive to pick from; the first picked moment becomes the cover.
 */
export function HighlightCreator({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  // Insertion order matters: it becomes the playback order and picks the cover.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ["own-active-stories", userId],
    queryFn: () => getOwnActiveStories(userId),
    enabled: open,
  });

  const toggle = (storyId: string) => {
    setSelectedIds((prev) =>
      prev.includes(storyId)
        ? prev.filter((id) => id !== storyId)
        : prev.length < MAX_STORIES_PER_HIGHLIGHT
          ? [...prev, storyId]
          : prev,
    );
  };

  const reset = () => {
    setTitle("");
    setSelectedIds([]);
  };

  const handleCreate = async () => {
    const trimmed = title.trim();
    if (!trimmed || selectedIds.length === 0 || saving) return;
    setSaving(true);
    try {
      await createHighlight(trimmed, selectedIds);
      queryClient.invalidateQueries({ queryKey: ["story-highlights", userId] });
      toast.success("Highlight created");
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Couldn't create highlight");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>New highlight</DialogTitle>
          <DialogDescription>
            Pick active moments to keep on your profile. The first one becomes
            the cover.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={MAX_TITLE_LENGTH}
            placeholder="Highlight name"
            aria-label="Highlight name"
          />

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : stories.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              No active moments to pick from. Post a moment first; expired
              moments can&apos;t be added.
            </p>
          ) : (
            <div className="grid max-h-[300px] grid-cols-3 gap-1.5 overflow-y-auto">
              {stories.map((story) => {
                const order = selectedIds.indexOf(story.id);
                const selected = order >= 0;
                const thumb = story.thumbnail_url ?? story.media_url;
                return (
                  <button
                    key={story.id}
                    onClick={() => toggle(story.id)}
                    aria-pressed={selected}
                    aria-label={selected ? "Remove moment" : "Add moment"}
                    className={`relative aspect-[9/16] cursor-pointer overflow-hidden rounded-lg border-2 ${
                      selected ? "border-primary" : "border-transparent"
                    }`}
                  >
                    {story.media_type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : story.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={story.thumbnail_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <video
                        src={story.media_url}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    )}
                    {selected && (
                      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        {order + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !title.trim() || selectedIds.length === 0}
          >
            {saving && <Loader2 className="animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
