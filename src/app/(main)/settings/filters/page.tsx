"use client";

import { useState, useEffect, useRef } from "react";
import { Filter, Plus, X, Search } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/use-auth";
import { useMutedWords } from "@/lib/hooks/use-content-safety";
import {
  addMutedWord,
  importMutedWords,
  removeMutedWord,
} from "@/lib/queries/content-safety";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FormSection, Input } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";

// Muted words used to live on-device under this key. The first visit
// after sign-in silently imports them into muted_words and clears it.
const LEGACY_STORAGE_KEY = "orbit_blocked_words";

export default function FiltersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: mutedWords = [], isLoading } = useMutedWords();
  const [newWord, setNewWord] = useState("");
  const [saving, setSaving] = useState(false);
  const migrationRan = useRef(false);

  useEffect(() => {
    if (!user || migrationRan.current) return;
    migrationRan.current = true;

    let raw: string | null = null;
    let legacyWords: unknown = [];
    try {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) legacyWords = JSON.parse(raw);
    } catch {
      // Unreadable legacy data; nothing worth migrating.
    }
    if (!raw) return;

    const words = Array.isArray(legacyWords)
      ? legacyWords
          .map((w) => String(w).trim().toLowerCase())
          .filter((w) => w.length > 0)
      : [];
    if (words.length === 0) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return;
    }

    importMutedWords(user.id, words)
      .then(() => {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        queryClient.invalidateQueries({ queryKey: ["muted-words", user.id] });
      })
      .catch(() => {
        // Keep the key so the import retries on the next visit.
      });
  }, [user, queryClient]);

  const handleAdd = async () => {
    const trimmed = newWord.trim().toLowerCase();
    if (!trimmed || !user || saving) return;
    if (mutedWords.includes(trimmed)) {
      toast.error("Already filtered");
      return;
    }
    setSaving(true);
    try {
      await addMutedWord(user.id, trimmed);
      queryClient.invalidateQueries({ queryKey: ["muted-words", user.id] });
      setNewWord("");
      toast.success(`Muted "${trimmed}"`);
    } catch {
      toast.error("Couldn't mute that word");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = async (word: string) => {
    if (!user) return;
    try {
      await removeMutedWord(user.id, word);
      queryClient.invalidateQueries({ queryKey: ["muted-words", user.id] });
      toast.success(`Unmuted "${word}"`);
    } catch {
      toast.error("Couldn't unmute that word");
    }
  };

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <SettingsHeader section="Filters" glyph="◆" />

      <div>
        <h1 className="mt-1 text-4xl sm:text-5xl font-bold leading-none tracking-[-0.035em] text-foreground">
          Mute <span className="text-primary">noise</span>.
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[14.5px] leading-[1.55] text-muted-foreground">
          Words you don&apos;t want to read. Hidden from feeds and comments
          everywhere you sign in.
        </p>
      </div>

      <FormSection title="Muted words" hint={`${mutedWords.length} muted`}>
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
          <Button onClick={handleAdd} disabled={!newWord.trim() || saving}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="mt-[18px] h-9 w-full rounded-xl" />
        ) : mutedWords.length === 0 ? (
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
            {mutedWords.map((word) => (
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
        Posts and comments containing your muted words are hidden from every
        feed (Home, Discover, Hashtag, Location). The list is saved to your
        account and syncs across all your devices.
      </div>
    </div>
  );
}
