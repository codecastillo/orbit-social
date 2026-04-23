"use client";

import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format";
import { Skeleton } from "@/components/ui/skeleton";
import { getTrendingHashtags, type TrendingHashtag } from "@/lib/queries/social";

export function TrendingTags() {
  const { data: tags, isLoading } = useQuery({
    queryKey: ["trending-hashtags"],
    queryFn: () => getTrendingHashtags(10),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="h-5 w-5 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!tags || tags.length === 0) return null;

  return (
    <div>
      <h2 className="px-4 pt-4 pb-2 text-lg font-bold">Trending</h2>
      <div className="space-y-0.5">
        {tags.map((tag, index) => (
          <TrendingTagItem key={tag.id} tag={tag} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}

function TrendingTagItem({
  tag,
  rank,
}: {
  tag: TrendingHashtag;
  rank: number;
}) {
  return (
    <Link
      href={`/explore?q=${encodeURIComponent(`#${tag.name}`)}`}
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        "hover:bg-accent/40 transition-colors"
      )}
    >
      <div className="flex items-center justify-center w-8 text-sm text-muted-foreground font-medium">
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">#{tag.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatNumber(tag.post_count)} posts
        </p>
      </div>
      <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}
