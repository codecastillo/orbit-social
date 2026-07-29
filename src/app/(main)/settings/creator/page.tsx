"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Eye,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatNumber, formatTimeAgo } from "@/lib/utils/format";
import {
  getCreatorStats,
  getPostPerformance,
  getFollowerGrowth,
  type CreatorStats,
  type PostPerformance,
  type FollowerGrowthDay,
} from "@/lib/queries/analytics";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCluster } from "@/components/orbit/stat-cluster";
import { SettingsHeader } from "@/components/settings/settings-header";

function formatGrowthDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function CreatorAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();

  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [topPosts, setTopPosts] = useState<PostPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [growth, setGrowth] = useState<FollowerGrowthDay[] | null>(null);
  const [growthError, setGrowthError] = useState(false);
  const [growthAttempt, setGrowthAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        const [statsData, postsData] = await Promise.all([
          getCreatorStats(user.id),
          getPostPerformance(user.id, 10),
        ]);
        setStats(statsData);
        setTopPosts(postsData);
      } catch {}
      setLoading(false);
    };
    loadData();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getFollowerGrowth(user.id)
      .then((growthData) => {
        if (cancelled) return;
        setGrowth(growthData);
        setGrowthError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setGrowth(null);
        setGrowthError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, growthAttempt]);

  if (authLoading || loading) {
    return (
      <div className="flex flex-col gap-[18px]">
        <Skeleton className="h-16 w-1/2 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[22px] text-foreground">
      <SettingsHeader section="Creator" glyph="◆" />

      <div>
        <h1 className="mt-1 text-4xl sm:text-5xl font-bold leading-none tracking-[-0.035em] text-foreground">
          Creator <span className="text-primary">tools</span>.
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[14.5px] leading-[1.55] text-muted-foreground">
          How your work moves through the orbit.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-7">
        <div className="pointer-events-none absolute inset-0 bg-primary/10" />
        <div className="relative">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            ◇&nbsp;&nbsp;LIFETIME TOTALS
          </p>
          <div className="mt-[18px]">
            <StatCluster
              items={[
                { n: stats?.totalPosts ?? 0, label: "posts" },
                { n: stats?.totalLikes ?? 0, label: "likes" },
                { n: stats?.totalComments ?? 0, label: "replies" },
                { n: stats?.totalViews ?? 0, label: "views" },
              ]}
            />
          </div>
        </div>
      </div>

      <div>
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
          ◈&nbsp;&nbsp;FOLLOWER GROWTH · LAST 30 DAYS
        </p>
        <div className="mt-3.5 rounded-xl border border-border bg-surface p-5">
          {growthError ? (
            <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
              <span>Couldn&apos;t load follower growth.</span>
              <button
                onClick={() => {
                  setGrowthError(false);
                  setGrowthAttempt((attempt) => attempt + 1);
                }}
                className="font-medium text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          ) : growth === null ? (
            <Skeleton className="h-24 w-full rounded-lg" />
          ) : growth.every((day) => day.count === 0) ? (
            <div className="py-4 text-center text-[13px] text-muted-foreground">
              No new followers in the last 30 days.
            </div>
          ) : (
            <>
              <div className="flex h-24 items-end gap-[3px]">
                {(() => {
                  const max = Math.max(...growth.map((day) => day.count));
                  return growth.map((day) => (
                    <div
                      key={day.date}
                      title={`${formatGrowthDate(day.date)}: ${day.count}`}
                      className="flex-1 rounded-t-sm bg-primary/60"
                      style={{
                        height:
                          day.count > 0
                            ? `${Math.max((day.count / max) * 100, 4)}%`
                            : "2px",
                      }}
                    />
                  ));
                })()}
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10.5px] tracking-[0.08em] text-text-faint">
                <span>{formatGrowthDate(growth[0].date)}</span>
                <span>
                  +{growth.reduce((sum, day) => sum + day.count, 0)} followers
                </span>
                <span>{formatGrowthDate(growth[growth.length - 1].date)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
          ◈&nbsp;&nbsp;TOP POSTS · BY REACH
        </p>
        <div className="mt-3.5 rounded-xl border border-border bg-surface p-2">
          {topPosts.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              No posts yet. Start creating to see your analytics here.
            </div>
          ) : (
            topPosts.map((post, index) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className={`flex items-start gap-3.5 p-3.5 text-foreground no-underline ${
                  index ? "border-t border-border" : ""
                }`}
              >
                <span
                  className={`min-w-[22px] text-xl leading-[1.1] ${
                    index === 0 ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 line-clamp-2 text-[13.5px] leading-normal text-foreground">
                    {post.content || "Media post"}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3.5 font-mono text-[11px] tracking-[0.04em] text-text-faint">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-[11px] w-[11px]" />
                      {formatNumber(post.like_count)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-[11px] w-[11px]" />
                      {formatNumber(post.comment_count)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-[11px] w-[11px]" />
                      {formatNumber(post.view_count)}
                    </span>
                    <span className="ml-auto">{formatTimeAgo(post.created_at)}</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
