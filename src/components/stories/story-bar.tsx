"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/use-auth";
import { useCurrentProfile } from "@/lib/hooks/use-profile";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  getActiveStories,
  type StoryGroup,
  type StoryWithAuthor,
} from "@/lib/queries/stories";
import { StoryViewer } from "./story-viewer";
import { StoryCreator } from "./story-creator";

/**
 * Small avatar chip overlapping a card's top-left corner. UserAvatar's
 * smallest size is 32px, too big for a 72px card, so this renders its own
 * 24px circle with the same initial fallback.
 */
function AvatarChip({
  src,
  fallback,
}: {
  src?: string | null;
  fallback: string;
}) {
  return (
    <span className="absolute -top-1.5 -left-1.5 z-10 flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-background">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[10px] font-semibold text-muted-foreground">
          {fallback.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/** The story's media as the card face; video falls back to a play glyph. */
function CardFace({ story }: { story: StoryWithAuthor }) {
  const src =
    story.media_type === "image"
      ? story.media_url
      : (story.thumbnail_url ?? null);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="h-full w-full object-cover" />;
  }
  return (
    <span className="flex h-full w-full items-center justify-center bg-surface-elevated">
      <Play className="h-5 w-5 text-white/70" fill="currentColor" />
    </span>
  );
}

/**
 * Rounded-rectangle moment preview card, Orbit's replacement for the
 * gradient-ringed avatar circle: the moment's media as the card face, the
 * author's avatar chip on the top-left, the name on a bottom scrim, and a
 * violet corner satellite-dot while unseen. Seen cards dim and lose the
 * dot; close-friends groups tint the dot and border emerald.
 */
function MomentCard({
  group,
  label,
  closeFriends,
  onClick,
}: {
  group: StoryGroup;
  label: string;
  closeFriends: boolean;
  onClick: () => void;
}) {
  const unseen = group.hasUnviewed;
  const face =
    group.stories.find((s) => !s.viewed) ?? group.stories[0];

  return (
    <button
      onClick={onClick}
      aria-label={`View moments from ${label}`}
      className="relative shrink-0 cursor-pointer"
    >
      <div
        className={cn(
          "relative h-24 w-[72px] overflow-hidden rounded-xl border bg-surface-elevated",
          closeFriends ? "border-success/70" : "border-border",
          !unseen && "opacity-60"
        )}
      >
        <CardFace story={face} />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-4 text-left">
          <span className="block truncate text-[10px] font-medium text-white">
            {label}
          </span>
        </span>
      </div>
      <AvatarChip src={group.user.avatar_url} fallback={group.user.username} />
      {unseen && (
        <span
          className={cn(
            "absolute -top-1 -right-1 z-10 h-2.5 w-2.5 rounded-full ring-2 ring-background",
            closeFriends ? "bg-success" : "bg-primary"
          )}
        />
      )}
    </button>
  );
}

export function StoryBar() {
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  // The daily moment prompt notification has no route of its own; it lands
  // here and raises this flag, which opens the creator alongside the local
  // "add moment" button.
  const momentCreatorOpen = useUIStore((s) => s.momentCreatorOpen);
  const setMomentCreatorOpen = useUIStore((s) => s.setMomentCreatorOpen);

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

  // Emerald tint when everything the viewer can see from this poster is
  // close friends only; a mixed group keeps the violet dot so public
  // stories aren't mislabeled as restricted.
  const isCloseFriendsGroup = (group: StoryGroup) =>
    group.stories.length > 0 &&
    group.stories.every((s) => s.visibility === "close_friends");

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
      <div className="px-4 pt-3 pb-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Moments</h3>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide px-4 py-2"
      >
        {/* Your moment: the live card when one exists, otherwise an add
            card that opens the creator. */}
        {hasOwnStory && currentUserGroup ? (
          <MomentCard
            group={currentUserGroup}
            label="You"
            closeFriends={isCloseFriendsGroup(currentUserGroup)}
            onClick={handleOwnStoryClick}
          />
        ) : (
          <button
            onClick={handleOwnStoryClick}
            aria-label="Create a moment"
            className="relative shrink-0 cursor-pointer"
          >
            <div className="flex h-24 w-[72px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-surface transition-colors hover:bg-surface-elevated">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Plus className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                Add
              </span>
            </div>
            <AvatarChip
              src={profile?.avatar_url}
              fallback={profile?.display_name || "U"}
            />
          </button>
        )}

        {/* Other users' moments */}
        {storyGroups
          .filter((g) => g.user.id !== user?.id)
          .map((group) => {
            const globalIndex = storyGroups.findIndex(
              (g) => g.user.id === group.user.id
            );
            return (
              <MomentCard
                key={group.user.id}
                group={group}
                label={group.user.username}
                closeFriends={isCloseFriendsGroup(group)}
                onClick={() => handleStoryClick(globalIndex)}
              />
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
      <StoryCreator
        open={creatorOpen || momentCreatorOpen}
        onOpenChange={(open) => {
          setCreatorOpen(open);
          if (!open) setMomentCreatorOpen(false);
        }}
      />
    </>
  );
}
