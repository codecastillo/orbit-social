import { create } from "zustand";

export type ComposeAction = "photo" | "voice" | "event" | "place" | null;

interface UIStore {
  composeOpen: boolean;
  composeCommunityId: string | undefined;
  composeAction: ComposeAction;
  // Optional seed text for the composer textarea — used by surfaces like the
  // hashtag page to prefill `#tag ` when the user clicks "Post with #tag".
  composeInitialContent: string | undefined;
  setComposeOpen: (
    open: boolean,
    options?: {
      communityId?: string;
      action?: ComposeAction;
      initialContent?: string;
    }
  ) => void;
  consumeComposeAction: () => ComposeAction;
  consumeComposeInitialContent: () => string | undefined;
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
  setComposeOpen: (open, options) =>
    set({
      composeOpen: open,
      composeCommunityId: open ? options?.communityId : undefined,
      composeAction: open ? (options?.action ?? null) : null,
      composeInitialContent: open ? options?.initialContent : undefined,
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
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  clipsMuted: true,
  setClipsMuted: (muted) => set({ clipsMuted: muted }),
}));
