"use client";

import { useState, useEffect } from "react";
import { Filter, Plus, X, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFilterStore } from "@/lib/stores/filter-store";

export default function FiltersPage() {
  const {
    blockedWords,
    addBlockedWord,
    removeBlockedWord,
    loadFromStorage,
  } = useFilterStore();
  const [newWord, setNewWord] = useState("");

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const handleAdd = () => {
    const trimmed = newWord.trim().toLowerCase();
    if (!trimmed) return;
    if (blockedWords.includes(trimmed)) {
      toast.error("Word already in your filter list");
      return;
    }
    addBlockedWord(trimmed);
    setNewWord("");
    toast.success(`Added "${trimmed}" to blocked words`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (word: string) => {
    removeBlockedWord(word);
    toast.success(`Removed "${word}" from blocked words`);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/60 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
            <Filter className="h-4.5 w-4.5 text-pink-400" />
          </div>
          <h1
            className="text-xl font-bold tracking-tight text-zinc-100"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Word Filters
          </h1>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Description */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-pink-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-zinc-300 font-medium">
                Hide posts containing specific words
              </p>
              <p className="text-sm text-zinc-500 mt-1">
                Posts containing your blocked words will be hidden from your
                feed. This applies to post content only and is stored locally on
                this device.
              </p>
            </div>
          </div>
        </div>

        {/* Add word input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a word to block..."
              className="input-premium pl-10"
            />
          </div>
          <Button
            onClick={handleAdd}
            disabled={!newWord.trim()}
            className="rounded-xl bg-pink-500 hover:bg-pink-600 text-white shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {/* Blocked words list */}
        {blockedWords.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
              <Filter className="h-6 w-6 text-zinc-500" />
            </div>
            <p className="text-zinc-300 font-medium">No blocked words</p>
            <p className="text-sm text-zinc-500 mt-1">
              Add words above to filter them from your feed.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
              {blockedWords.length} blocked word
              {blockedWords.length !== 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {blockedWords.map((word) => (
                <div
                  key={word}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] group hover:border-red-500/30 transition-colors"
                >
                  <span className="text-sm text-zinc-300">{word}</span>
                  <button
                    onClick={() => handleRemove(word)}
                    className="h-5 w-5 flex items-center justify-center rounded-full text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
