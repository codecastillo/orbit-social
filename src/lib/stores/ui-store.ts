import { create } from "zustand";

export type ComposeAction = "photo" | "voice" | "event" | "place" | null;

interface UIStore {
  composeOpen: boolean;
  composeCommunityId: string | undefined;
  composeAction: ComposeAction;
  setComposeOpen: (
    open: boolean,
    options?: { communityId?: string; action?: ComposeAction }
  ) => void;
  consumeComposeAction: () => ComposeAction;
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
  setComposeOpen: (open, options) =>
    set({
      composeOpen: open,
      composeCommunityId: open ? options?.communityId : undefined,
      composeAction: open ? (options?.action ?? null) : null,
    }),
  consumeComposeAction: () => {
    const current = get().composeAction;
    if (current) set({ composeAction: null });
    return current;
  },
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  clipsMuted: true,
  setClipsMuted: (muted) => set({ clipsMuted: muted }),
}));
