import { create } from "zustand";

interface FilterStore {
  blockedWords: string[];
  addBlockedWord: (word: string) => void;
  removeBlockedWord: (word: string) => void;
  loadFromStorage: () => void;
  containsBlockedWord: (text: string) => boolean;
}

const STORAGE_KEY = "orbit_blocked_words";

function saveToStorage(words: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  } catch {
    // localStorage not available
  }
}

function readFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // localStorage not available
  }
  return [];
}

export const useFilterStore = create<FilterStore>((set, get) => ({
  blockedWords: [],

  addBlockedWord: (word: string) => {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) return;
    const current = get().blockedWords;
    if (current.includes(trimmed)) return;
    const updated = [...current, trimmed];
    set({ blockedWords: updated });
    saveToStorage(updated);
  },

  removeBlockedWord: (word: string) => {
    const updated = get().blockedWords.filter((w) => w !== word);
    set({ blockedWords: updated });
    saveToStorage(updated);
  },

  loadFromStorage: () => {
    const words = readFromStorage();
    set({ blockedWords: words });
  },

  containsBlockedWord: (text: string) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return get().blockedWords.some((word) => lower.includes(word));
  },
}));
