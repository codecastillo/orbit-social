"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, ChevronLeft, ChevronRight, Eye, Loader2, Trash2 } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils/format";
import { useAuth } from "@/lib/hooks/use-auth";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ConfirmDialog } from "@/components/orbit/confirm-dialog";
import {
  deleteStory,
  getStoryViewers,
  markStoryViewed,
  type StoryGroup,
} from "@/lib/queries/stories";

interface StoryViewerProps {
  storyGroups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}

export function StoryViewer({
  storyGroups,
  initialGroupIndex,
  onClose,
}: StoryViewerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  // Keyed to the story id so navigating away naturally dismisses the panel.
  const [viewersForStoryId, setViewersForStoryId] = useState<string | null>(
    null
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const elapsedRef = useRef(0);

  const currentGroup = storyGroups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];
  const duration = (currentStory?.duration_seconds || 5) * 1000;
  const isOwnStory = !!user?.id && currentStory?.user_id === user.id;
  const viewersOpen =
    !!currentStory && viewersForStoryId === currentStory.id;
  const overlayOpen = confirmDeleteOpen || viewersOpen;

  const { data: viewers, isLoading: viewersLoading } = useQuery({
    queryKey: ["story-viewers", currentStory?.id],
    queryFn: () => getStoryViewers(currentStory!.id),
    enabled: viewersOpen && isOwnStory,
  });

  // Mark story as viewed
  useEffect(() => {
    if (currentStory && user?.id && currentStory.user_id !== user.id) {
      markStoryViewed(currentStory.id, user.id).catch(() => {
        // Silently fail on view tracking
      });
    }
  }, [currentStory?.id, user?.id, currentStory?.user_id]);

  const goToNextStory = useCallback(() => {
    if (!currentGroup) return;

    if (storyIndex < currentGroup.stories.length - 1) {
      // Next story in same group
      setStoryIndex((prev) => prev + 1);
      setProgress(0);
      elapsedRef.current = 0;
    } else if (groupIndex < storyGroups.length - 1) {
      // Next group
      setGroupIndex((prev) => prev + 1);
      setStoryIndex(0);
      setProgress(0);
      elapsedRef.current = 0;
    } else {
      // End of all stories
      onClose();
    }
  }, [currentGroup, storyIndex, groupIndex, storyGroups.length, onClose]);

  const goToPrevStory = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
      setProgress(0);
      elapsedRef.current = 0;
    } else if (groupIndex > 0) {
      const prevGroup = storyGroups[groupIndex - 1];
      setGroupIndex((prev) => prev - 1);
      setStoryIndex(prevGroup.stories.length - 1);
      setProgress(0);
      elapsedRef.current = 0;
    }
  }, [storyIndex, groupIndex, storyGroups]);

  const goToNextGroup = useCallback(() => {
    if (groupIndex < storyGroups.length - 1) {
      setGroupIndex((prev) => prev + 1);
      setStoryIndex(0);
      setProgress(0);
      elapsedRef.current = 0;
    } else {
      onClose();
    }
  }, [groupIndex, storyGroups.length, onClose]);

  const goToPrevGroup = useCallback(() => {
    if (groupIndex > 0) {
      setGroupIndex((prev) => prev - 1);
      setStoryIndex(0);
      setProgress(0);
      elapsedRef.current = 0;
    }
  }, [groupIndex]);

  const handleDelete = useCallback(async () => {
    if (!currentStory) return;
    try {
      await deleteStory(currentStory.id);
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      toast.success("Moment deleted");
      // Close the viewer: the refetched groups can reindex under us.
      onClose();
    } catch {
      toast.error("Couldn't delete moment");
    }
  }, [currentStory, queryClient, onClose]);

  // Progress timer, held while a dialog or the viewers list is open
  useEffect(() => {
    if (paused || overlayOpen || !currentStory) return;

    const intervalMs = 50;
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed =
        elapsedRef.current + (Date.now() - startTimeRef.current);
      const pct = Math.min(elapsed / duration, 1);
      setProgress(pct);

      if (pct >= 1) {
        if (timerRef.current) clearInterval(timerRef.current);
        goToNextStory();
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        elapsedRef.current += Date.now() - startTimeRef.current;
        clearInterval(timerRef.current);
      }
    };
  }, [paused, overlayOpen, currentStory?.id, duration, goToNextStory]);

  // Reset elapsed when story changes
  useEffect(() => {
    elapsedRef.current = 0;
  }, [currentStory?.id]);

  // Keyboard navigation
  useEffect(() => {
    if (overlayOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowLeft":
          goToPrevStory();
          break;
        case "ArrowRight":
          goToNextStory();
          break;
        case "ArrowUp":
          goToPrevGroup();
          break;
        case "ArrowDown":
          goToNextGroup();
          break;
        case "Escape":
          onClose();
          break;
        case " ":
          e.preventDefault();
          setPaused((p) => !p);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [overlayOpen, goToNextStory, goToPrevStory, goToNextGroup, goToPrevGroup, onClose]);

  // Prevent body scroll when viewer is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!currentGroup || !currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Previous group arrow */}
      {groupIndex > 0 && (
        <button
          onClick={goToPrevGroup}
          aria-label="Previous user's stories"
          className="absolute left-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition hidden md:flex"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next group arrow */}
      {groupIndex < storyGroups.length - 1 && (
        <button
          onClick={goToNextGroup}
          aria-label="Next user's stories"
          className="absolute right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition hidden md:flex"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Story container */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${groupIndex}-${storyIndex}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md h-full max-h-[100dvh] md:max-h-[90dvh] md:rounded-xl overflow-hidden bg-black"
        >
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2 pt-3">
            {currentGroup.stories.map((_, i) => (
              <div
                key={i}
                className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden"
              >
                <div
                  className="h-full bg-white rounded-full transition-none"
                  style={{
                    width:
                      i < storyIndex
                        ? "100%"
                        : i === storyIndex
                          ? `${progress * 100}%`
                          : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-6 left-0 right-0 z-20 flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <UserAvatar
                src={currentGroup.user.avatar_url}
                fallback={currentGroup.user.username}
                size="sm"
              />
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-medium">
                  {currentGroup.user.username}
                </span>
                <span className="text-white/60 text-xs">
                  {formatTimeAgo(currentStory.created_at)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isOwnStory && (
                <button
                  onClick={() => setConfirmDeleteOpen(true)}
                  aria-label="Delete moment"
                  className="p-1.5 rounded-full hover:bg-white/10 text-white transition"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={onClose}
                aria-label="Close stories"
                className="p-1.5 rounded-full hover:bg-white/10 text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Story content */}
          <div className="absolute inset-0 flex items-center justify-center">
            {currentStory.media_type === "image" ? (
              <Image
                src={currentStory.media_url}
                alt="Story"
                fill
                sizes="100vw"
                className="object-contain"
                draggable={false}
              />
            ) : (
              <video
                src={currentStory.media_url}
                className="w-full h-full object-contain"
                autoPlay
                muted
                playsInline
              />
            )}
          </div>

          {/* Click zones for prev/next */}
          <div className="absolute inset-0 z-10 flex">
            <button
              className="w-1/3 h-full"
              onClick={goToPrevStory}
              onMouseDown={() => setPaused(true)}
              onMouseUp={() => setPaused(false)}
              onTouchStart={() => setPaused(true)}
              onTouchEnd={() => setPaused(false)}
              aria-label="Previous story"
            />
            <button
              className="w-1/3 h-full"
              onMouseDown={() => setPaused(true)}
              onMouseUp={() => setPaused(false)}
              onTouchStart={() => setPaused(true)}
              onTouchEnd={() => setPaused(false)}
              aria-label="Pause story"
            />
            <button
              className="w-1/3 h-full"
              onClick={goToNextStory}
              onMouseDown={() => setPaused(true)}
              onMouseUp={() => setPaused(false)}
              onTouchStart={() => setPaused(true)}
              onTouchEnd={() => setPaused(false)}
              aria-label="Next story"
            />
          </div>

          {/* Viewer count, own stories only. Tap to see who watched. */}
          {isOwnStory && (
            <button
              onClick={() => setViewersForStoryId(currentStory.id)}
              aria-label="See who viewed this moment"
              className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-white text-sm hover:bg-black/70 transition"
            >
              <Eye className="h-4 w-4" />
              {currentStory.view_count}
            </button>
          )}

          {/* Viewers list */}
          {viewersOpen && (
            <div className="absolute inset-x-0 bottom-0 z-30 max-h-[55%] flex flex-col rounded-t-2xl bg-black/95 border-t border-white/10">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <span className="text-white text-sm font-semibold">
                  Viewers
                </span>
                <button
                  onClick={() => setViewersForStoryId(null)}
                  aria-label="Close viewers list"
                  className="p-1.5 rounded-full hover:bg-white/10 text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {viewersLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-white/60" />
                  </div>
                ) : viewers && viewers.length > 0 ? (
                  <ul className="space-y-3">
                    {viewers.map((v) => (
                      <li key={v.viewer_id} className="flex items-center gap-2.5">
                        <UserAvatar
                          src={v.profiles.avatar_url}
                          fallback={v.profiles.display_name || v.profiles.username}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {v.profiles.display_name || v.profiles.username}
                          </p>
                          <p className="text-white/60 text-xs truncate">
                            @{v.profiles.username}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-white/60 text-sm text-center py-6">
                    No views yet
                  </p>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete this moment?"
        description="It disappears for everyone right away."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
      />
    </div>
  );
}
