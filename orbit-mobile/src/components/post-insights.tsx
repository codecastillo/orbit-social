import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Post } from "@/lib/queries/posts";
import type { EngagementSample } from "@/lib/queries/profiles";
import { formatNumber } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

/** Above or below this multiple of the author's own average is worth saying. */
const ABOVE = 1.2;
const BELOW = 0.8;

export interface AuthorAverages {
  avgLikeRate: number;
  avgEngagementRate: number;
}

/**
 * Averages across an author's own posts, so a post is compared to their
 * normal rather than to a platform number that means nothing to them.
 *
 * Undefined below two posts: an average of one is that post, and telling
 * someone their only post is exactly average is noise.
 */
export function computeAuthorAverages(
  posts: EngagementSample[],
): AuthorAverages | undefined {
  if (posts.length < 2) return undefined;
  let likeRate = 0;
  let engagementRate = 0;
  for (const post of posts) {
    const views = Math.max(post.view_count, 1);
    likeRate += post.like_count / views;
    engagementRate +=
      (post.like_count + post.comment_count + post.repost_count) / views;
  }
  return {
    avgLikeRate: likeRate / posts.length,
    avgEngagementRate: engagementRate / posts.length,
  };
}

/**
 * What one post did, shown only to its author. Mirrors the web PostInsights.
 *
 * Rates are per view rather than raw counts, because a post with 40 likes
 * from 4000 views did worse than one with 10 from 100, and raw counts hide
 * that. Views come from the anonymous counter, not from the per-viewer
 * impressions table, which is never exposed to authors.
 */
export function PostInsights({
  post,
  averages,
}: {
  post: Post;
  averages?: AuthorAverages;
}) {
  const stats = useMemo(() => {
    const views = Math.max(post.view_count, 1);
    const engagementRate =
      (post.like_count + post.comment_count + post.repost_count) / views;

    let performance: "above" | "below" | "average" = "average";
    if (averages) {
      if (engagementRate > averages.avgEngagementRate * ABOVE) {
        performance = "above";
      } else if (engagementRate < averages.avgEngagementRate * BELOW) {
        performance = "below";
      }
    }
    return { views, engagementRate, performance };
  }, [post, averages]);

  const verdict =
    stats.performance === "above"
      ? { label: "Doing better than your usual", color: colors.success }
      : stats.performance === "below"
        ? { label: "Quieter than your usual", color: colors.mutedForeground }
        : { label: "About your usual", color: colors.mutedForeground };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="stats-chart-outline" size={14} color={colors.mutedForeground} />
        <Text style={styles.headerLabel}>Only you can see this</Text>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Views" value={formatNumber(post.view_count)} />
        <Stat label="Likes" value={formatNumber(post.like_count)} />
        <Stat label="Comments" value={formatNumber(post.comment_count)} />
        <Stat label="Reposts" value={formatNumber(post.repost_count)} />
      </View>

      <Text style={styles.rate}>
        {(stats.engagementRate * 100).toFixed(1)}% of people who saw it did
        something
      </Text>

      {averages ? (
        <Text style={[styles.verdict, { color: verdict.color }]}>
          {verdict.label}
        </Text>
      ) : (
        <Text style={styles.verdict}>
          Post a couple more and this will compare them to each other.
        </Text>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing(2),
    padding: spacing(3.5),
    marginTop: spacing(3),
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
  },
  headerLabel: {
    color: colors.mutedForeground,
    fontSize: 11.5,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stat: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    color: colors.mutedForeground,
    fontSize: 11.5,
    marginTop: 2,
  },
  rate: {
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
  },
  verdict: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    fontWeight: "600",
  },
});
