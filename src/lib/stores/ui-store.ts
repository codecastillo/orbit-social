import { create } from "zustand";

interface UIStore {
  composeOpen: boolean;
  composeCommunityId: string | undefined;
  setComposeOpen: (open: boolean, communityId?: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  composeOpen: false,
  composeCommunityId: undefined,
  setComposeOpen: (open, communityId) =>
    set({ composeOpen: open, composeCommunityId: open ? communityId : undefined }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
}));
