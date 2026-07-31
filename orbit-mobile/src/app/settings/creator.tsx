import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Centered, EmptyState } from "@/components/ui";
import {
  getCreatorStats,
  getFollowerGrowth,
  getPostPerformance,
  type FollowerGrowthDay,
  type PostPerformance,
} from "@/lib/queries/analytics";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

function formatGrowthDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{formatNumber(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// The web page renders a bar chart here; mobile keeps summary numbers.
function GrowthSummary({ growth }: { growth: FollowerGrowthDay[] }) {
  const total = growth.reduce((sum, day) => sum + day.count, 0);
  if (total === 0) {
    return (
      <Text style={styles.sectionEmpty}>
        No new followers in the last 30 days.
      </Text>
    );
  }
  const best = growth.reduce((a, b) => (b.count > a.count ? b : a));
  return (
    <View style={styles.growthCard}>
      <View style={styles.growthRow}>
        <Text style={styles.growthValue}>+{formatNumber(total)}</Text>
        <Text style={styles.growthLabel}>new followers</Text>
      </View>
      <Text style={styles.growthHint}>
        Best day: {formatGrowthDate(best.date)} with +{best.count}. Period:{" "}
        {formatGrowthDate(growth[0].date)} to{" "}
        {formatGrowthDate(growth[growth.length - 1].date)}.
      </Text>
    </View>
  );
}

function TopPostRow({
  post,
  rank,
  onPress,
}: {
  post: PostPerformance;
  rank: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.postRow, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.postRank, rank === 1 && { color: colors.primary }]}>
        {rank}
      </Text>
      <View style={styles.postBody}>
        <Text style={styles.postContent} numberOfLines={2}>
          {post.content || "Media post"}
        </Text>
        <View style={styles.postMeta}>
          <Ionicons name="heart-outline" size={11} color={colors.textFaint} />
          <Text style={styles.postMetaText}>{formatNumber(post.like_count)}</Text>
          <Ionicons name="chatbubble-outline" size={11} color={colors.textFaint} />
          <Text style={styles.postMetaText}>
            {formatNumber(post.comment_count)}
          </Text>
          <Ionicons name="eye-outline" size={11} color={colors.textFaint} />
          <Text style={styles.postMetaText}>{formatNumber(post.view_count)}</Text>
          <Text style={[styles.postMetaText, styles.postTime]}>
            {formatTimeAgo(post.created_at)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function CreatorAnalyticsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const statsQuery = useQuery({
    queryKey: ["creator-stats", user?.id],
    queryFn: () => getCreatorStats(user!.id),
    enabled: !!user,
  });

  const topPostsQuery = useQuery({
    queryKey: ["creator-top-posts", user?.id],
    queryFn: () => getPostPerformance(user!.id, 10),
    enabled: !!user,
  });

  const growthQuery = useQuery({
    queryKey: ["creator-follower-growth", user?.id],
    queryFn: () => getFollowerGrowth(user!.id),
    enabled: !!user,
  });

  if (!user) return null;

  if (statsQuery.isPending && topPostsQuery.isPending) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Creator analytics" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </View>
    );
  }

  if (statsQuery.isError && topPostsQuery.isError) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title: "Creator analytics" }} />
        <EmptyState
          title="Analytics did not load"
          description="Check your connection and try again."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => {
                statsQuery.refetch();
                topPostsQuery.refetch();
                growthQuery.refetch();
              }}
            />
          }
        />
      </View>
    );
  }

  const stats = statsQuery.data;
  const topPosts = topPostsQuery.data ?? [];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Creator analytics" }} />

      <Text style={styles.sectionTitle}>Lifetime totals</Text>
      <View style={styles.statGrid}>
        <StatCard value={stats?.totalPosts ?? 0} label="posts" />
        <StatCard value={stats?.totalLikes ?? 0} label="likes" />
        <StatCard value={stats?.totalComments ?? 0} label="replies" />
        <StatCard value={stats?.totalViews ?? 0} label="views" />
      </View>

      <Text style={styles.sectionTitle}>Follower growth · last 30 days</Text>
      {growthQuery.isError ? (
        <View style={styles.growthErrorRow}>
          <Text style={styles.sectionEmpty}>
            Couldn&apos;t load follower growth.
          </Text>
          <Button
            label="Retry"
            variant="outline"
            style={styles.retryButton}
            onPress={() => growthQuery.refetch()}
          />
        </View>
      ) : growthQuery.isPending ? (
        <View style={styles.sectionPending}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <GrowthSummary growth={growthQuery.data} />
      )}

      <Text style={styles.sectionTitle}>Top posts · by reach</Text>
      {topPosts.length === 0 ? (
        <Text style={styles.sectionEmpty}>
          No posts yet. Start creating to see your analytics here.
        </Text>
      ) : (
        topPosts.map((post, index) => (
          <TopPostRow
            key={post.id}
            post={post}
            rank={index + 1}
            onPress={() => router.push(`/post/${post.id}` as Href)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingVertical: spacing(2),
    paddingBottom: spacing(8),
  },
  sectionTitle: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    paddingBottom: spacing(1),
  },
  sectionPending: {
    paddingVertical: spacing(4),
  },
  sectionEmpty: {
    color: colors.mutedForeground,
    fontSize: 13,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(2.5),
    paddingHorizontal: spacing(4),
    paddingTop: spacing(1),
  },
  statCard: {
    flexGrow: 1,
    flexBasis: "45%",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing(3.5),
  },
  statValue: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  statLabel: {
    marginTop: 2,
    color: colors.mutedForeground,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  growthCard: {
    marginHorizontal: spacing(4),
    marginTop: spacing(1),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing(3.5),
  },
  growthRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing(2),
  },
  growthValue: {
    color: colors.success,
    fontSize: 22,
    fontWeight: "700",
  },
  growthLabel: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  growthHint: {
    marginTop: spacing(1.5),
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 17,
  },
  growthErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: spacing(4),
  },
  retryButton: {
    minHeight: 34,
    paddingHorizontal: spacing(3.5),
  },
  postRow: {
    flexDirection: "row",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  postRank: {
    minWidth: 22,
    color: colors.mutedForeground,
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 22,
  },
  postBody: {
    flex: 1,
    minWidth: 0,
  },
  postContent: {
    color: colors.foreground,
    fontSize: 13.5,
    lineHeight: 18,
  },
  postMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
    marginTop: spacing(1.5),
  },
  postMetaText: {
    color: colors.textFaint,
    fontSize: 11,
    marginRight: spacing(2),
  },
  postTime: {
    marginLeft: "auto",
    marginRight: 0,
  },
});
