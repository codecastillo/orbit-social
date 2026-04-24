"use client";

import Link from "next/link";
import { Play } from "lucide-react";

const mockClips = [
  { id: "1", gradient: "from-violet-600 to-fuchsia-500", name: "trending_audio", views: "12K" },
  { id: "2", gradient: "from-cyan-500 to-blue-600", name: "dance_challenge", views: "8.4K" },
  { id: "3", gradient: "from-rose-500 to-orange-500", name: "cooking_hack", views: "24K" },
  { id: "4", gradient: "from-emerald-500 to-teal-600", name: "travel_vlog", views: "5.2K" },
  { id: "5", gradient: "from-amber-500 to-red-500", name: "fitness_tip", views: "18K" },
  { id: "6", gradient: "from-indigo-500 to-purple-600", name: "tech_review", views: "9.1K" },
];

export function ClipsCarousel() {
  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2">
      {mockClips.map((clip) => (
        <Link
          key={clip.id}
          href="/reels"
          className="shrink-0 w-[130px] aspect-[9/16] rounded-2xl overflow-hidden relative group cursor-pointer"
        >
          {/* Gradient background */}
          <div className={`absolute inset-0 bg-gradient-to-br ${clip.gradient}`} />

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-colors">
              <Play className="h-5 w-5 text-white fill-white ml-0.5" />
            </div>
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/60 to-transparent">
            <p className="text-white text-[11px] font-medium truncate">@{clip.name}</p>
            <p className="text-white/60 text-[10px]">{clip.views} views</p>
          </div>

          {/* Hover */}
          <div className="absolute inset-0 bg-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ))}
    </div>
  );
}
