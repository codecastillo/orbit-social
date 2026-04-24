"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/use-auth";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getActiveStories, type StoryGroup } from "@/lib/queries/stories";
import { StoryViewer } from "./story-viewer";
import { StoryCreator } from "./story-creator";

export function StoryBar() {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  const { data: storyGroups = [] } = useQuery({
    queryKey: ["stories", user?.id],
    queryFn: () => getActiveStories(user!.id),
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });

  const currentUserGroup = storyGroups.find(
    (g) => g.user.id === user?.id
  );
  const hasOwnStory = !!currentUserGroup && currentUserGroup.stories.length > 0;

  function handleStoryClick(groupIndex: number) {
    setActiveGroupIndex(groupIndex);
    setViewerOpen(true);
  }

  function handleOwnStoryClick() {
    if (hasOwnStory) {
      // Find the index of the current user's group
      const idx = storyGroups.findIndex((g) => g.user.id === user?.id);
      if (idx >= 0) {
        handleStoryClick(idx);
      }
    } else {
      setCreatorOpen(true);
    }
  }

  return (
    <>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide px-4 py-3 border-b border-border"
      >
        {/* Your Story */}
        <button
          onClick={handleOwnStoryClick}
          className="flex flex-col items-center gap-1 shrink-0"
        >
          <div className="relative">
            <UserAvatar
              src={user?.user_metadata?.avatar_url}
              fallback={user?.user_metadata?.username || "U"}
              size="lg"
              hasStory={hasOwnStory && currentUserGroup?.hasUnviewed}
            />
            {!hasOwnStory && (
              <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground border-2 border-background">
                <Plus className="h-3 w-3" />
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground truncate w-16 text-center">
            Your moment
          </span>
        </button>

        {/* Other users' stories */}
        {storyGroups
          .filter((g) => g.user.id !== user?.id)
          .map((group) => {
            const globalIndex = storyGroups.findIndex(
              (g) => g.user.id === group.user.id
            );
            return (
              <button
                key={group.user.id}
                onClick={() => handleStoryClick(globalIndex)}
                className="flex flex-col items-center gap-1 shrink-0"
              >
                <UserAvatar
                  src={group.user.avatar_url}
                  fallback={group.user.username}
                  size="lg"
                  hasStory={group.hasUnviewed}
                />
                <span
                  className={cn(
                    "text-xs truncate w-16 text-center",
                    group.hasUnviewed
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {group.user.username}
                </span>
              </button>
            );
          })}
      </div>

      {/* Story Viewer */}
      {viewerOpen && storyGroups.length > 0 && (
        <StoryViewer
          storyGroups={storyGroups}
          initialGroupIndex={activeGroupIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {/* Story Creator */}
      <StoryCreator open={creatorOpen} onOpenChange={setCreatorOpen} />
    </>
  );
}
