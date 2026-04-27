"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  max?: number;
  placeholder?: string;
  suggestions?: string[];
}

function sanitize(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 20);
}

export function TagChipsField({
  tags,
  onChange,
  max = 5,
  placeholder = "Add tag and press Enter",
  suggestions,
}: Props) {
  const [value, setValue] = useState("");

  const addTag = (raw: string) => {
    const clean = sanitize(raw);
    if (!clean) return;
    if (tags.some((t) => t.toLowerCase() === clean)) return;
    if (tags.length >= max) return;
    onChange([...tags, clean]);
    setValue("");
  };

  const removeTag = (slug: string) => {
    onChange(tags.filter((t) => t !== slug));
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(value);
    } else if (e.key === "Backspace" && value === "" && tags.length > 0) {
      e.preventDefault();
      removeTag(tags[tags.length - 1]);
    }
  };

  const visibleSuggestions = (suggestions ?? []).filter(
    (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()),
  );

  const atMax = tags.length >= max;

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl bg-white/[0.02] border border-white/10 focus-within:border-cyan-400/40 focus-within:ring-2 focus-within:ring-cyan-400/15 px-2.5 py-2 transition-all">
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="group inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-violet-500/15 border border-violet-400/30 text-violet-200 text-[12px] font-bold"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag}`}
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-violet-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {!atMax && (
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKey}
              placeholder={tags.length === 0 ? placeholder : ""}
              className="bg-transparent border-none outline-none text-[13px] text-white placeholder:text-white/30 flex-1 min-w-[140px] py-1"
            />
          )}
        </div>
      </div>
      {visibleSuggestions.length > 0 && !atMax && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] uppercase tracking-wider text-white/30 font-mono mr-1">
            Trending
          </span>
          {visibleSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-white/[0.03] border border-white/10 text-white/55 text-[11px] hover:bg-violet-500/10 hover:border-violet-400/30 hover:text-violet-200 transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
