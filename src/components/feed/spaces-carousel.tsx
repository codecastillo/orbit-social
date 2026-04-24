"use client";

import Link from "next/link";
import { Users } from "lucide-react";

const mockSpaces = [
  { slug: "photography", name: "Photography", members: "2.4K", gradient: "from-blue-600 to-indigo-700" },
  { slug: "gaming", name: "Gaming", members: "8.1K", gradient: "from-emerald-600 to-green-700" },
  { slug: "music", name: "Music Lovers", members: "5.3K", gradient: "from-violet-600 to-purple-700" },
  { slug: "fitness", name: "Fitness", members: "3.7K", gradient: "from-orange-500 to-red-600" },
  { slug: "tech", name: "Tech Talk", members: "12K", gradient: "from-cyan-500 to-blue-600" },
];

export function SpacesCarousel() {
  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2">
      {mockSpaces.map((space) => (
        <Link
          key={space.slug}
          href={`/communities/${space.slug}`}
          className="shrink-0 w-[200px] aspect-[3/2] rounded-2xl overflow-hidden relative group cursor-pointer"
        >
          {/* Gradient background */}
          <div className={`absolute inset-0 bg-gradient-to-br ${space.gradient}`} />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-end p-4">
            <h3 className="text-white font-bold text-base">{space.name}</h3>
            <div className="flex items-center gap-1.5 mt-1 text-white/70 text-xs">
              <Users className="h-3 w-3" />
              {space.members} members
            </div>
          </div>

          {/* Hover */}
          <div className="absolute inset-0 bg-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ))}
    </div>
  );
}
