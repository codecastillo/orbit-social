"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/utils/format";
import { useAuth } from "@/lib/hooks/use-auth";
import { UserAvatar } from "@/components/shared/user-avatar";
import { markStoryViewed, type StoryGroup } from "@/lib/queries/stories";

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
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const elapsedRef = useRef(0);

  const currentGroup = storyGroups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];
  const duration = (currentStory?.duration_seconds || 5) * 1000;

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

  // Progress timer
  useEffect(() => {
    if (paused || !currentStory) return;

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
  }, [paused, currentStory?.id, duration, goToNextStory]);

  // Reset elapsed when story changes
  useEffect(() => {
    elapsedRef.current = 0;
  }, [currentStory?.id]);

  // Keyboard navigation
  useEffect(() => {
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
  }, [goToNextStory, goToPrevStory, goToNextGroup, goToPrevGroup, onClose]);

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
          className="absolute left-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition hidden md:flex"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next group arrow */}
      {groupIndex < storyGroups.length - 1 && (
        <button
          onClick={goToNextGroup}
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
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Story content */}
          <div className="absolute inset-0 flex items-center justify-center">
            {currentStory.media_type === "image" ? (
              <img
                src={currentStory.media_url}
                alt="Story"
                className="w-full h-full object-contain"
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
