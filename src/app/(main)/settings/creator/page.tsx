"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Heart,
  MessageCircle,
  Eye,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatNumber, formatTimeAgo } from "@/lib/utils/format";
import {
  getCreatorStats,
  getPostPerformance,
  type CreatorStats,
  type PostPerformance,
} from "@/lib/queries/analytics";
import { Skeleton } from "@/components/ui/skeleton";

export default function CreatorAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();

  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [topPosts, setTopPosts] = useState<PostPerformance[]>([]);
  const [loading, setLoading] = useState(true);

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
      } catch {
        // Silently handle errors — stats will show as 0
      }
      setLoading(false);
    };

    loadData();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="border-x border-border min-h-screen">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Posts",
      value: stats?.totalPosts ?? 0,
      icon: FileText,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
    },
    {
      label: "Total Likes",
      value: stats?.totalLikes ?? 0,
      icon: Heart,
      color: "text-pink-400",
      bgColor: "bg-pink-400/10",
    },
    {
      label: "Total Comments",
      value: stats?.totalComments ?? 0,
      icon: MessageCircle,
      color: "text-green-400",
      bgColor: "bg-green-400/10",
    },
    {
      label: "Total Views",
      value: stats?.totalViews ?? 0,
      icon: Eye,
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
    },
  ];

  return (
    <div className="border-x border-border min-h-screen">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-lg font-semibold">Creator Analytics</h2>
      </div>

      {/* Stats Overview */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="glass rounded-xl p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${card.bgColor}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {formatNumber(card.value)}
              </p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Top Performing Posts */}
      <div className="p-4 pt-2 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Top Performing Posts</h3>
        </div>

        {topPosts.length === 0 ? (
          <div className="glass rounded-xl p-6 text-center text-muted-foreground text-sm">
            No posts yet. Start creating content to see analytics.
          </div>
        ) : (
          <div className="space-y-2">
            {topPosts.map((post, index) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="glass rounded-xl p-4 block hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 pt-0.5 shrink-0">
                    #{index + 1}
                  </span>
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-sm line-clamp-2">
                      {post.content || "Media post"}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {formatNumber(post.like_count)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {formatNumber(post.comment_count)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {formatNumber(post.view_count)}
                      </span>
                      <span className="ml-auto">
                        {formatTimeAgo(post.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
