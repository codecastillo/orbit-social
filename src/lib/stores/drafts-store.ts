import { create } from "zustand";

export interface Draft {
  id: string;
  content: string;
  media: { preview: string; type: "image" | "video" | "gif" }[];
  location?: string;
  createdAt: string;
  updatedAt: string;
}

const DRAFTS_KEY = "orbit_drafts";

function loadDrafts(): Draft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistDrafts(drafts: Draft[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // localStorage full or unavailable
  }
}

interface DraftsStore {
  drafts: Draft[];
  hydrated: boolean;
  hydrate: () => void;
  saveDraft: (content: string, media?: Draft["media"], location?: string) => string;
  updateDraft: (id: string, content: string, media?: Draft["media"], location?: string) => void;
  getDrafts: () => Draft[];
  getDraft: (id: string) => Draft | undefined;
  deleteDraft: (id: string) => void;
}

export const useDraftsStore = create<DraftsStore>((set, get) => ({
  drafts: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const drafts = loadDrafts();
    set({ drafts, hydrated: true });
  },

  saveDraft: (content, media = [], location) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const draft: Draft = {
      id,
      content,
      media,
      location,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [draft, ...get().drafts];
    set({ drafts: updated });
    persistDrafts(updated);
    return id;
  },

  updateDraft: (id, content, media = [], location) => {
    const updated = get().drafts.map((d) =>
      d.id === id
        ? { ...d, content, media, location, updatedAt: new Date().toISOString() }
        : d
    );
    set({ drafts: updated });
    persistDrafts(updated);
  },

  getDrafts: () => get().drafts,

  getDraft: (id) => get().drafts.find((d) => d.id === id),

  deleteDraft: (id) => {
    const updated = get().drafts.filter((d) => d.id !== id);
    set({ drafts: updated });
    persistDrafts(updated);
  },
}));
