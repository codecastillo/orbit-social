"use client";

import { useState, useEffect } from "react";
import { Filter, Plus, X, Search } from "lucide-react";
import { toast } from "sonner";
import { useFilterStore } from "@/lib/stores/filter-store";
import { Button } from "@/components/ui/button";
import { FormSection, Input } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";

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
      toast.error("Already filtered");
      return;
    }
    addBlockedWord(trimmed);
    setNewWord("");
    toast.success(`Muted "${trimmed}"`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (word: string) => {
    removeBlockedWord(word);
    toast.success(`Unmuted "${word}"`);
  };

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <SettingsHeader section="Filters" glyph="◆" />

      <div>
        <h1 className="mt-1 text-5xl font-bold leading-none tracking-[-0.035em] text-foreground">
          Mute <span className="text-primary">noise</span>.
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[14.5px] leading-[1.55] text-muted-foreground">
          Words you don&apos;t want to read. Hidden from feeds on this device.
        </p>
      </div>

      <FormSection title="Muted words" hint={`${blockedWords.length} on this device`}>
        <div className="flex gap-2.5">
          <div className="flex-1">
            <Input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a word to mute…"
              prefix={<Search className="h-3.5 w-3.5" />}
            />
          </div>
          <Button onClick={handleAdd} disabled={!newWord.trim()}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        {blockedWords.length === 0 ? (
          <div className="pb-4 pt-8 text-center text-[13px] text-muted-foreground">
            <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-surface">
              <Filter className="h-5 w-5 text-text-faint" />
            </div>
            <p className="m-0 font-semibold text-text-secondary">Nothing muted yet.</p>
            <p className="mt-1 text-xs text-text-faint">
              Add a word above to filter it from your feed.
            </p>
          </div>
        ) : (
          <div className="mt-[18px] flex flex-wrap gap-2">
            {blockedWords.map((word) => (
              <div
                key={word}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1.5 font-mono text-xs tracking-[0.02em] text-text-secondary"
              >
                {word}
                <button
                  onClick={() => handleRemove(word)}
                  aria-label={`Unmute "${word}"`}
                  className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-muted-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      <div className="mt-2 rounded-xl border border-border bg-surface p-[18px] text-[12.5px] leading-[1.55] text-muted-foreground">
        <strong className="font-semibold text-text-secondary">How this works:</strong>{" "}
        Posts containing your muted words are hidden from every feed (Home, Discover,
        Hashtag, Location). This list is stored on your device and doesn't sync across
        other browsers.
      </div>
    </div>
  );
}
