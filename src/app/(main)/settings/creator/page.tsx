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
  type CreatorStats,
  type PostPerformance,
} from "@/lib/queries/analytics";
import { Skeleton } from "@/components/ui/skeleton";
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow } from "@/components/orbit/primitives";
import { StatCluster } from "@/components/orbit/stat-cluster";
import { SettingsHeader } from "@/components/settings/settings-header";

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
      } catch {}
      setLoading(false);
    };
    loadData();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Skeleton className="h-16 w-1/2 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div style={{ color: O.ink, fontFamily: O.sans, display: "flex", flexDirection: "column", gap: 22 }}>
      <SettingsHeader section="Creator" glyph="◆" />

      <div>
        <Display size={48} style={{ marginTop: 4 }}>
          Creator <Acc>tools</Acc>.
        </Display>
        <p style={{ fontSize: 14.5, color: O.ink3, marginTop: 10, lineHeight: 1.55, maxWidth: 560 }}>
          How your work moves through the orbit.
        </p>
      </div>

      <div
        style={{
          ...panel({ borderRadius: 22 }),
          padding: 28,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${O.a1}1a 0%, ${O.a2}14 50%, ${O.a3}1a 100%)`,
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative" }}>
          <Eyebrow>◇&nbsp;&nbsp;LIFETIME TOTALS</Eyebrow>
          <div style={{ marginTop: 18 }}>
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
        <Eyebrow accent>◈&nbsp;&nbsp;TOP POSTS · BY REACH</Eyebrow>
        <div
          style={{
            ...panel({ borderRadius: 18 }),
            padding: 8,
            marginTop: 14,
          }}
        >
          {topPosts.length === 0 ? (
            <div
              style={{
                padding: "32px 16px",
                textAlign: "center",
                color: O.ink3,
                fontSize: 13,
              }}
            >
              No posts yet. Start creating to see your analytics here.
            </div>
          ) : (
            topPosts.map((post, index) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 14px",
                  borderTop: index ? `1px solid ${O.hair}` : "none",
                  color: O.ink,
                  textDecoration: "none",
                }}
              >
                <span
                  style={{
                    fontFamily: O.serif,
                    fontStyle: "italic",
                    fontSize: 20,
                    color: index === 0 ? O.a2 : O.ink3,
                    minWidth: 22,
                    lineHeight: 1.1,
                  }}
                >
                  {index + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      margin: 0,
                      color: O.ink,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {post.content || "Media post"}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      marginTop: 6,
                      fontSize: 11,
                      color: O.ink4,
                      fontFamily: O.mono,
                      letterSpacing: "0.04em",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Heart style={{ width: 11, height: 11 }} />
                      {formatNumber(post.like_count)}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <MessageCircle style={{ width: 11, height: 11 }} />
                      {formatNumber(post.comment_count)}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Eye style={{ width: 11, height: 11 }} />
                      {formatNumber(post.view_count)}
                    </span>
                    <span style={{ marginLeft: "auto" }}>{formatTimeAgo(post.created_at)}</span>
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
