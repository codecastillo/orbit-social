import { create } from "zustand";
import type { PostWithAuthor } from "@/lib/queries/posts";

export type ComposeAction = "photo" | "voice" | "event" | "place" | null;

interface UIStore {
  composeOpen: boolean;
  composeCommunityId: string | undefined;
  composeAction: ComposeAction;
  // Optional seed text for the composer textarea, used by surfaces like the
  // hashtag page to prefill `#tag ` when the user clicks "Post with #tag".
  composeInitialContent: string | undefined;
  // Draft being edited: the composer seeds itself from this draft and, on
  // post, removes it so "Keep writing" round-trips instead of dead-ending.
  composeDraftId: string | undefined;
  // Post being quoted: the composer renders it read-only below the textarea
  // and submits a type "quote" post pointing at it.
  composeQuotedPost: PostWithAuthor | undefined;
  setComposeOpen: (
    open: boolean,
    options?: {
      communityId?: string;
      action?: ComposeAction;
      initialContent?: string;
      draftId?: string;
      quotedPost?: PostWithAuthor;
    }
  ) => void;
  consumeComposeAction: () => ComposeAction;
  consumeComposeInitialContent: () => string | undefined;
  // Raised by the daily moment prompt notification, which navigates home and
  // asks the story bar there to open its creator.
  momentCreatorOpen: boolean;
  setMomentCreatorOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  // Single mute state shared across every ClipPlayer so unmuting one clip
  // carries across to the next as you scroll.
  clipsMuted: boolean;
  setClipsMuted: (muted: boolean) => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  composeOpen: false,
  composeCommunityId: undefined,
  composeAction: null,
  composeInitialContent: undefined,
  composeDraftId: undefined,
  composeQuotedPost: undefined,
  setComposeOpen: (open, options) =>
    set({
      composeOpen: open,
      composeCommunityId: open ? options?.communityId : undefined,
      composeAction: open ? (options?.action ?? null) : null,
      composeInitialContent: open ? options?.initialContent : undefined,
      composeDraftId: open ? options?.draftId : undefined,
      composeQuotedPost: open ? options?.quotedPost : undefined,
    }),
  consumeComposeAction: () => {
    const current = get().composeAction;
    if (current) set({ composeAction: null });
    return current;
  },
  consumeComposeInitialContent: () => {
    const current = get().composeInitialContent;
    if (current !== undefined) set({ composeInitialContent: undefined });
    return current;
  },
  momentCreatorOpen: false,
  setMomentCreatorOpen: (open) => set({ momentCreatorOpen: open }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  clipsMuted: true,
  setClipsMuted: (muted) => set({ clipsMuted: muted }),
}));
