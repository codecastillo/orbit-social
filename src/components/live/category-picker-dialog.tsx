"use client";

import { useEffect, useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { Search, X, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LIVE_CATEGORIES, isLiveCategorySlug } from "@/lib/constants/live-categories";
import {
  LIVE_GAMES,
  LIVE_GAMES_BY_SLUG,
  coverArtUrl,
  isLiveGameSlug,
  type LiveGameSlug,
} from "@/lib/constants/live-games";

type Selection = { category: string | null; gameSlug: string | null };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: Selection;
  onSave: (next: Selection) => void | Promise<void>;
}

type Tab = "categories" | "games";

function resolveLucideIcon(name: string): React.ComponentType<{ className?: string; size?: number }> {
  const lookup = Icons as unknown as Record<string, React.ComponentType<{ className?: string; size?: number }>>;
  return lookup[name] ?? Icons.Sparkles;
}

export function CategoryPickerDialog({ open, onOpenChange, value, onSave }: Props) {
  const initialTab: Tab = value.gameSlug ? "games" : "categories";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const [localCategory, setLocalCategory] = useState<string | null>(value.category);
  const [localGame, setLocalGame] = useState<string | null>(value.gameSlug);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(value.gameSlug ? "games" : "categories");
      setQuery("");
      setLocalCategory(value.category);
      setLocalGame(value.gameSlug);
    }
  }, [open, value.category, value.gameSlug]);

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LIVE_CATEGORIES;
    return LIVE_CATEGORIES.filter((c) => c.label.toLowerCase().includes(q));
  }, [query]);

  const filteredGames = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LIVE_GAMES;
    return LIVE_GAMES.filter((g) => g.label.toLowerCase().includes(q));
  }, [query]);

  const changed = localCategory !== value.category || localGame !== value.gameSlug;

  const selectedLabel = (() => {
    if (localGame && isLiveGameSlug(localGame)) return LIVE_GAMES_BY_SLUG[localGame].label;
    if (localCategory && isLiveCategorySlug(localCategory)) {
      const c = LIVE_CATEGORIES.find((x) => x.slug === localCategory);
      return c?.label ?? null;
    }
    return null;
  })();

  const pickCategory = (slug: string) => {
    setLocalCategory(slug);
    if (slug !== "gaming") setLocalGame(null);
  };

  const pickGame = (slug: LiveGameSlug) => {
    setLocalGame(slug);
    setLocalCategory("gaming");
  };

  const clearSelection = () => {
    setLocalCategory(null);
    setLocalGame(null);
  };

  const handleSave = async () => {
    if (!changed) return;
    setSaving(true);
    try {
      await onSave({ category: localCategory, gameSlug: localGame });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl max-h-[80vh] overflow-hidden p-0 flex flex-col gap-0 bg-[#0c0c14] text-white border-white/10"
      >
        <DialogHeader className="flex-row items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <DialogTitle className="text-[15px] font-bold text-white">Set your category</DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search games or categories"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/[0.04] border border-white/10 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/15 transition-all"
            />
          </div>
        </div>

        <div className="px-5 pt-1 pb-3 flex items-center gap-2">
          <button
            onClick={() => setTab("categories")}
            className={`h-8 px-3.5 rounded-full text-[12px] font-bold transition-colors ${
              tab === "categories"
                ? "bg-cyan-400/15 text-cyan-200 border border-cyan-400/30"
                : "bg-white/[0.03] text-white/60 border border-white/10 hover:text-white"
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setTab("games")}
            className={`h-8 px-3.5 rounded-full text-[12px] font-bold transition-colors ${
              tab === "games"
                ? "bg-cyan-400/15 text-cyan-200 border border-cyan-400/30"
                : "bg-white/[0.03] text-white/60 border border-white/10 hover:text-white"
            }`}
          >
            Games
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {tab === "categories" ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {filteredCategories.map((c) => {
                const Icon = resolveLucideIcon(c.iconName);
                const selected = localCategory === c.slug && !localGame;
                return (
                  <button
                    key={c.slug}
                    onClick={() => pickCategory(c.slug)}
                    className={`aspect-[6/7] rounded-2xl flex flex-col items-center justify-center gap-2.5 px-2 text-center transition-all ${
                      selected
                        ? "bg-cyan-400/10 border border-cyan-400/60 ring-2 ring-cyan-400/30"
                        : "bg-white/[0.04] border border-white/10 hover:border-cyan-400/40"
                    }`}
                  >
                    <Icon size={28} className="text-white/85" />
                    <span className="text-[13px] font-bold text-white leading-tight line-clamp-2">
                      {c.label}
                    </span>
                  </button>
                );
              })}
              {filteredCategories.length === 0 && (
                <div className="col-span-full text-center py-8 text-[13px] text-white/40">
                  No categories match &ldquo;{query}&rdquo;
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {filteredGames.map((g) => {
                const selected = localGame === g.slug;
                return (
                  <GameTile
                    key={g.slug}
                    label={g.label}
                    slug={g.slug}
                    accentHue={g.accentHue}
                    selected={selected}
                    onClick={() => pickGame(g.slug)}
                  />
                );
              })}
              {filteredGames.length === 0 && (
                <div className="col-span-full text-center py-8 text-[13px] text-white/40">
                  No games match &ldquo;{query}&rdquo;
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between gap-3 bg-white/[0.02]">
          <div className="min-w-0 flex-1">
            {selectedLabel ? (
              <div className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-200 text-[12px] font-bold max-w-full">
                <span className="truncate">Selected: {selectedLabel}</span>
                <button
                  onClick={clearSelection}
                  aria-label="Clear selection"
                  className="hover:text-white -mr-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <span className="text-[12px] text-white/40">Pick a category or game</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 rounded-xl text-[12.5px] font-semibold text-white/70 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!changed || saving}
              className="h-9 px-4 rounded-xl text-[12.5px] font-bold bg-gradient-to-br from-cyan-400 to-violet-500 text-white shadow-[0_4px_14px_rgba(34,211,238,0.3)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GameTile({
  label,
  slug,
  accentHue,
  selected,
  onClick,
}: {
  label: string;
  slug: LiveGameSlug;
  accentHue: number;
  selected: boolean;
  onClick: () => void;
}) {
  const [errored, setErrored] = useState(false);
  const src = coverArtUrl(slug);
  return (
    <button
      onClick={onClick}
      className={`aspect-[3/4] rounded-2xl overflow-hidden relative group transition-all ${
        selected
          ? "ring-2 ring-cyan-400/70 shadow-[0_0_0_4px_rgba(34,211,238,0.15)]"
          : "ring-1 ring-white/10 hover:ring-2 hover:ring-cyan-400/40"
      }`}
    >
      {!errored && src ? (
        <img
          src={src}
          alt={label}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setErrored(true)}
          draggable={false}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-center px-3"
          style={{ background: `oklch(0.4 0.18 ${accentHue})` }}
        >
          <span className="text-[14px] font-extrabold text-white/95 line-clamp-3">
            {label}
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-2 pt-6 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-left">
        <div className="text-[12px] font-bold text-white leading-tight line-clamp-2">
          {label}
        </div>
      </div>
    </button>
  );
}

export type { Selection as CategorySelection };
export { ChevronDown };
