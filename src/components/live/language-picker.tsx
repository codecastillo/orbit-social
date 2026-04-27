"use client";

import { ChevronDown, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LIVE_LANGUAGES, type LiveLanguageCode } from "@/lib/constants/live-categories";

interface Props {
  value: LiveLanguageCode;
  onChange: (next: LiveLanguageCode) => void;
}

export function LanguagePicker({ value, onChange }: Props) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 h-7 rounded-lg bg-white/[0.05] border border-white/10 text-white/85 text-[11.5px] font-semibold hover:bg-white/[0.08] hover:text-white transition-colors"
          >
            <span className="font-mono uppercase tracking-wider">{value}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        }
      />
      <PopoverContent
        align="start"
        className="w-56 bg-[#0c0c14] border-white/10 p-1"
      >
        <div className="flex flex-col">
          {LIVE_LANGUAGES.map((lang) => {
            const active = lang.code === value;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => onChange(lang.code)}
                className={`flex items-center gap-2.5 w-full text-left px-2 h-9 rounded-lg text-[13px] transition-colors ${
                  active
                    ? "bg-cyan-400/10 text-white"
                    : "text-white/85 hover:bg-white/[0.05]"
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center px-1.5 h-5 rounded-md text-[10px] font-mono uppercase font-bold ${
                    active
                      ? "bg-cyan-400/15 border border-cyan-400/40 text-cyan-200"
                      : "bg-white/[0.06] border border-white/10 text-white/70"
                  }`}
                >
                  {lang.code}
                </span>
                <span className="flex-1">{lang.label}</span>
                {active && <Check className="h-3.5 w-3.5 text-cyan-300" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
