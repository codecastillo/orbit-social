"use client";

import { useState, useMemo } from "react";
import { ChevronDown, Eye, Heart, TrendingUp, TrendingDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format";
import type { PostWithAuthor } from "@/lib/queries/posts";

interface PostInsightsProps {
  post: PostWithAuthor;
  /** Average stats from the user's other posts, used for comparison. */
  userAverages?: {
    avgLikeRate: number;
    avgEngagementRate: number;
  };
}

/**
 * Expandable engagement insights panel — only shown to the post author.
 * Displays view count, like rate, engagement rate, and a performance comparison.
 */
export function PostInsights({ post, userAverages }: PostInsightsProps) {
  const [expanded, setExpanded] = useState(false);

  const stats = useMemo(() => {
    const views = Math.max(post.view_count, 1);
    const likeRate = post.like_count / views;
    const engagementRate =
      (post.like_count + post.comment_count + post.repost_count) / views;

    // If we have averages, compare
    let performance: "above" | "below" | "average" = "average";
    if (userAverages) {
      if (engagementRate > userAverages.avgEngagementRate * 1.2) {
        performance = "above";
      } else if (engagementRate < userAverages.avgEngagementRate * 0.8) {
        performance = "below";
      }
    }

    return { views, likeRate, engagementRate, performance };
  }, [post, userAverages]);

  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md transition-colors",
          "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
        )}
      >
        <TrendingUp className="h-3 w-3" />
        Post insights
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 px-2 py-2.5 bg-white/[0.02] rounded-lg border border-white/[0.06]">
              {/* Stats row */}
              <div className="flex items-center gap-4">
                <StatItem
                  icon={<Eye className="h-3.5 w-3.5" />}
                  label="Views"
                  value={formatNumber(stats.views)}
                />
                <StatItem
                  icon={<Heart className="h-3.5 w-3.5" />}
                  label="Like rate"
                  value={`${(stats.likeRate * 100).toFixed(1)}%`}
                />
                <StatItem
                  icon={<TrendingUp className="h-3.5 w-3.5" />}
                  label="Engagement"
                  value={`${(stats.engagementRate * 100).toFixed(1)}%`}
                />
              </div>

              {/* Performance comparison */}
              {userAverages && (
                <div
                  className={cn(
                    "mt-2.5 flex items-center gap-1.5 text-[11px] font-medium px-2 py-1.5 rounded-md",
                    stats.performance === "above" &&
                      "bg-emerald-500/10 text-emerald-400",
                    stats.performance === "below" &&
                      "bg-rose-500/10 text-rose-400",
                    stats.performance === "average" &&
                      "bg-zinc-500/10 text-zinc-400"
                  )}
                >
                  {stats.performance === "above" ? (
                    <>
                      <TrendingUp className="h-3 w-3" />
                      This post is performing above average
                    </>
                  ) : stats.performance === "below" ? (
                    <>
                      <TrendingDown className="h-3 w-3" />
                      This post is performing below average
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-3 w-3" />
                      This post is performing on par with your average
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
      <div className="flex items-center gap-1 text-zinc-400">{icon}</div>
      <span className="text-[13px] font-semibold text-zinc-200">{value}</span>
      <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
  );
}

/**
 * Helper to compute average stats from a list of posts.
 * Call this once with the user's recent posts and pass the result to PostInsights.
 */
export function computeUserAverages(
  posts: PostWithAuthor[]
): { avgLikeRate: number; avgEngagementRate: number } | undefined {
  if (!posts || posts.length < 2) return undefined;

  let totalLikeRate = 0;
  let totalEngRate = 0;

  for (const p of posts) {
    const views = Math.max(p.view_count, 1);
    totalLikeRate += p.like_count / views;
    totalEngRate += (p.like_count + p.comment_count + p.repost_count) / views;
  }

  return {
    avgLikeRate: totalLikeRate / posts.length,
    avgEngagementRate: totalEngRate / posts.length,
  };
}
