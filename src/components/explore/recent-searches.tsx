"use client";

import { X } from "lucide-react";
import {
  recentSearchLabel,
  type RecentSearch,
} from "@/lib/recent-searches";

interface RecentSearchesProps {
  items: RecentSearch[];
  onSelect: (entry: RecentSearch) => void;
  onRemove: (entry: RecentSearch) => void;
  onClearAll: () => void;
}

export function RecentSearches({
  items,
  onSelect,
  onRemove,
  onClearAll,
}: RecentSearchesProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Recent
        </p>
        <button
          onClick={onClearAll}
          className="cursor-pointer text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          Clear all
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((entry) => {
          const label = recentSearchLabel(entry);
          return (
            <span
              key={`${entry.kind}:${entry.value}`}
              className="flex items-center gap-1 rounded-full border border-border bg-surface pl-3 pr-1.5 py-1 text-[13px] text-foreground"
            >
              <button
                onClick={() => onSelect(entry)}
                className="cursor-pointer max-w-[220px] truncate hover:text-primary"
              >
                {label}
              </button>
              <button
                onClick={() => onRemove(entry)}
                aria-label={`Remove ${label} from recent searches`}
                className="cursor-pointer rounded-full p-1 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
