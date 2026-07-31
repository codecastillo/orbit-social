import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, Button, EmptyState } from "@/components/ui";
import {
  followUser,
  unfollowUser,
} from "@/lib/queries/profiles";
import {
  getSuggestedUsers,
  getTrendingHashtags,
  searchPosts,
  searchUsers,
  type ProfileSummary,
  type SearchPost,
} from "@/lib/queries/search";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

const SEARCH_DEBOUNCE_MS = 300;
const EXCERPT_LENGTH = 120;

type Segment = "people" | "posts";

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function excerpt(content: string | null): string {
  if (!content) return "Shared a post";
  return content.length > EXCERPT_LENGTH
    ? `${content.slice(0, EXCERPT_LENGTH).trimEnd()}...`
    : content;
}

export default function DiscoverScreen() {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("people");
  const debouncedQuery = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);
  const isSearching = debouncedQuery.length > 0;

  return (
    <View style={styles.flex}>
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people, posts, tags"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery("")}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {isSearching ? (
        <SearchResults
          query={debouncedQuery}
          segment={segment}
          onSegmentChange={setSegment}
        />
      ) : (
        <DiscoverHome
          onTagPress={(name) => {
            setSegment("posts");
            setQuery(`#${name}`);
          }}
        />
      )}
    </View>
  );
}

function SegmentedControl({
  segment,
  onChange,
}: {
  segment: Segment;
  onChange: (segment: Segment) => void;
}) {
  return (
    <View style={styles.segments}>
      {(["people", "posts"] as const).map((value) => {
        const active = segment === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(value)}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
              {value === "people" ? "People" : "Posts"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SearchResults({
  query,
  segment,
  onSegmentChange,
}: {
  query: string;
  segment: Segment;
  onSegmentChange: (segment: Segment) => void;
}) {
  const router = useRouter();

  const peopleQuery = useQuery({
    queryKey: ["search-users", query],
    queryFn: () => searchUsers(query),
    enabled: segment === "people",
  });

  const postsQuery = useQuery({
    queryKey: ["search-posts", query],
    queryFn: () => searchPosts(query),
    enabled: segment === "posts",
  });

  const active = segment === "people" ? peopleQuery : postsQuery;
  const header = <SegmentedControl segment={segment} onChange={onSegmentChange} />;

  if (active.isPending) {
    return (
      <View style={styles.flex}>
        {header}
        <View style={styles.resultsState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (active.isError) {
    return (
      <View style={styles.flex}>
        {header}
        <EmptyState
          title="Search failed"
          description="Check your connection and try again."
          action={
            <Button label="Retry" variant="outline" onPress={() => active.refetch()} />
          }
        />
      </View>
    );
  }

  if (segment === "people") {
    return (
      <View style={styles.flex}>
        {header}
        <FlatList
          data={peopleQuery.data ?? []}
          keyExtractor={(person) => person.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <PersonRow
              person={item}
              onPress={() => router.push(`/user/${item.username}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title="No people found"
              description={`Nobody matches "${query}".`}
            />
          }
          contentContainerStyle={styles.resultsContent}
        />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {header}
      <FlatList
        data={postsQuery.data ?? []}
        keyExtractor={(post) => post.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <PostResultRow
            post={item}
            onPress={() => router.push(`/post/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No posts found"
            description={`Nothing matches "${query}".`}
          />
        }
        contentContainerStyle={styles.resultsContent}
      />
    </View>
  );
}

function PersonRow({
  person,
  onPress,
}: {
  person: ProfileSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.personRow, pressed && { opacity: 0.7 }]}
    >
      <Avatar url={person.avatar_url} name={person.display_name} size={44} />
      <View style={styles.personInfo}>
        <View style={styles.personNameRow}>
          <Text style={styles.personName} numberOfLines={1}>
            {person.display_name}
          </Text>
          {person.is_verified ? (
            <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
          ) : null}
        </View>
        <Text style={styles.personUsername} numberOfLines={1}>
          @{person.username}
          {"  "}
          {formatNumber(person.follower_count)} followers
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

function PostResultRow({
  post,
  onPress,
}: {
  post: SearchPost;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.postRow, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.postMeta}>
        <Text style={styles.postAuthor} numberOfLines={1}>
          {post.profiles?.display_name ?? "Unknown"}
          {"  "}
          <Text style={styles.postUsername}>
            @{post.profiles?.username ?? "unknown"}
          </Text>
        </Text>
        <Text style={styles.postTime}>{formatTimeAgo(post.created_at)}</Text>
      </View>
      <Text style={styles.postContent}>{excerpt(post.content)}</Text>
    </Pressable>
  );
}

function DiscoverHome({ onTagPress }: { onTagPress: (name: string) => void }) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.homeContent}
      keyboardShouldPersistTaps="handled"
    >
      <TrendingCard onTagPress={onTagPress} />
      <SuggestedPeople />
      <ExploreLinks />
    </ScrollView>
  );
}

function TrendingCard({ onTagPress }: { onTagPress: (name: string) => void }) {
  const trendingQuery = useQuery({
    queryKey: ["trending-hashtags"],
    queryFn: () => getTrendingHashtags(5),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Trending now</Text>
      {trendingQuery.isPending ? (
        <View style={styles.cardState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : trendingQuery.isError ? (
        <View style={styles.cardState}>
          <Text style={styles.cardStateText}>Could not load trends.</Text>
          <Button
            label="Retry"
            variant="outline"
            onPress={() => trendingQuery.refetch()}
          />
        </View>
      ) : (trendingQuery.data?.length ?? 0) === 0 ? (
        <Text style={styles.cardEmptyText}>
          Nothing trending in the last day. Post with a #tag to get one moving.
        </Text>
      ) : (
        trendingQuery.data?.map((tag, index) => (
          <Pressable
            key={tag.id}
            accessibilityRole="button"
            onPress={() => onTagPress(tag.name)}
            style={({ pressed }) => [
              styles.trendRow,
              index > 0 && styles.trendRowBorder,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[styles.trendRank, index === 0 && { color: colors.primary }]}
            >
              {index + 1}
            </Text>
            <View style={styles.trendInfo}>
              <Text style={styles.trendName}>#{tag.name}</Text>
              <Text style={styles.trendCount}>
                {formatNumber(tag.post_count)} posts today
              </Text>
            </View>
            <Ionicons name="trending-up" size={13} color={colors.success} />
          </Pressable>
        ))
      )}
    </View>
  );
}

function SuggestedPeople() {
  const { user } = useAuth();
  const router = useRouter();
  // Optimistic follow state, reverted if the write fails.
  const [followedIds, setFollowedIds] = useState<ReadonlySet<string>>(new Set());

  const suggestedQuery = useQuery({
    queryKey: ["suggested-users", user?.id],
    queryFn: () => getSuggestedUsers(user!.id, 8),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  function setFollowed(targetId: string, followed: boolean) {
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (followed) next.add(targetId);
      else next.delete(targetId);
      return next;
    });
  }

  async function toggleFollow(targetId: string) {
    if (!user) return;
    const wasFollowing = followedIds.has(targetId);
    setFollowed(targetId, !wasFollowing);
    try {
      if (wasFollowing) await unfollowUser(user.id, targetId);
      else await followUser(user.id, targetId);
    } catch {
      setFollowed(targetId, wasFollowing);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>People to orbit</Text>
      {suggestedQuery.isPending ? (
        <View style={styles.cardState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : suggestedQuery.isError ? (
        <View style={styles.cardState}>
          <Text style={styles.cardStateText}>Could not load suggestions.</Text>
          <Button
            label="Retry"
            variant="outline"
            onPress={() => suggestedQuery.refetch()}
          />
        </View>
      ) : (suggestedQuery.data?.length ?? 0) === 0 ? (
        <Text style={styles.cardEmptyText}>
          No suggestions yet. Follow a few people to seed your orbit.
        </Text>
      ) : (
        <FlatList
          horizontal
          data={suggestedQuery.data ?? []}
          keyExtractor={(person) => person.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.peopleRow}
          renderItem={({ item }) => {
            const following = followedIds.has(item.id);
            return (
              <View style={styles.personCard}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/user/${item.username}`)}
                  style={({ pressed }) => [
                    styles.personCardTop,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Avatar url={item.avatar_url} name={item.display_name} size={56} />
                  <Text style={styles.personCardName} numberOfLines={1}>
                    {item.display_name}
                  </Text>
                  <Text style={styles.personCardUsername} numberOfLines={1}>
                    @{item.username}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => toggleFollow(item.id)}
                  style={({ pressed }) => [
                    styles.followButton,
                    following && styles.followButtonOutline,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.followLabel,
                      following && styles.followLabelOutline,
                    ]}
                  >
                    {following ? "Following" : "Follow"}
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const EXPLORE_LINKS = [
  {
    // These routes ship in a parallel change; typed routes pick them up on
    // the next expo start, hence the Href casts below.
    path: "/communities" as Href,
    icon: "people-outline" as const,
    title: "Communities",
    subtitle: "Find your corners of Orbit",
  },
  {
    path: "/events" as Href,
    icon: "calendar-outline" as const,
    title: "Events",
    subtitle: "What is happening near you",
  },
  {
    path: "/marketplace" as Href,
    icon: "storefront-outline" as const,
    title: "Marketplace",
    subtitle: "Buy and sell in your orbit",
  },
];

function ExploreLinks() {
  const router = useRouter();
  return (
    <View style={styles.exploreLinks}>
      {EXPLORE_LINKS.map((link) => (
        <Pressable
          key={link.title}
          accessibilityRole="button"
          onPress={() => router.push(link.path)}
          style={({ pressed }) => [styles.exploreCard, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.exploreIcon}>
            <Ionicons name={link.icon} size={18} color={colors.primary} />
          </View>
          <View style={styles.exploreInfo}>
            <Text style={styles.exploreTitle}>{link.title}</Text>
            <Text style={styles.exploreSubtitle}>{link.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchWrap: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    paddingBottom: spacing(2),
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    minHeight: 44,
    paddingHorizontal: spacing(3),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 14,
    paddingVertical: spacing(2.5),
  },
  segments: {
    flexDirection: "row",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  segment: {
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(1.5),
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  segmentLabelActive: {
    color: colors.primaryForeground,
  },
  resultsState: {
    padding: spacing(8),
    alignItems: "center",
  },
  resultsContent: {
    flexGrow: 1,
    paddingBottom: spacing(8),
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  personInfo: {
    flex: 1,
  },
  personNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  personName: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  personUsername: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 1,
  },
  postRow: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  postMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(2),
  },
  postAuthor: {
    color: colors.foreground,
    fontSize: 13.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  postUsername: {
    color: colors.mutedForeground,
    fontWeight: "400",
    fontSize: 12.5,
  },
  postTime: {
    color: colors.textFaint,
    fontSize: 12,
  },
  postContent: {
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 4,
  },
  homeContent: {
    padding: spacing(4),
    paddingTop: spacing(2),
    gap: spacing(3),
    paddingBottom: spacing(8),
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing(4),
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: spacing(2),
  },
  cardState: {
    paddingVertical: spacing(4),
    alignItems: "center",
    gap: spacing(3),
  },
  cardStateText: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  cardEmptyText: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: spacing(2),
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingVertical: spacing(2.5),
  },
  trendRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  trendRank: {
    color: colors.mutedForeground,
    fontSize: 18,
    fontWeight: "700",
    fontStyle: "italic",
    minWidth: 20,
  },
  trendInfo: {
    flex: 1,
  },
  trendName: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  trendCount: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 1,
  },
  peopleRow: {
    gap: spacing(2.5),
    paddingTop: spacing(1),
  },
  personCard: {
    width: 132,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    padding: spacing(3),
  },
  personCardTop: {
    alignItems: "center",
  },
  personCardName: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
    marginTop: spacing(2),
    maxWidth: "100%",
  },
  personCardUsername: {
    color: colors.mutedForeground,
    fontSize: 11.5,
    marginTop: 1,
    maxWidth: "100%",
  },
  followButton: {
    marginTop: spacing(2.5),
    minHeight: 32,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  followButtonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  followLabel: {
    color: colors.primaryForeground,
    fontSize: 12.5,
    fontWeight: "600",
  },
  followLabelOutline: {
    color: colors.foreground,
  },
  exploreLinks: {
    gap: spacing(3),
  },
  exploreCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing(4),
  },
  exploreIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreInfo: {
    flex: 1,
  },
  exploreTitle: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  exploreSubtitle: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 1,
  },
});
