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
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Image } from "expo-image";
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
  searchClips,
  searchPosts,
  searchUsers,
  type ProfileSummary,
  type SearchClip,
  type SearchPost,
} from "@/lib/queries/search";
import { useVideoFrame } from "@/lib/video-frame";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

const SEARCH_DEBOUNCE_MS = 300;
const EXCERPT_LENGTH = 120;
const CLIP_GRID_GAP = 1;
const CLIP_GRID_COLUMNS = 3;

type Segment = "people" | "posts" | "clips";

const SEGMENT_LABELS: Record<Segment, string> = {
  people: "People",
  posts: "Posts",
  clips: "Clips",
};

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

  // Other tabs deep-link here with ?q= (hashtag taps in post bodies, the
  // clips search button); seed the box so results show immediately. State is
  // adjusted during render (React's documented prop-change pattern) instead
  // of in an effect, so there is no extra empty-query render in between.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [seededQ, setSeededQ] = useState<string | undefined>(undefined);
  if (q !== seededQ) {
    setSeededQ(q);
    if (typeof q === "string" && q.length > 0) {
      setQuery(q);
      if (q.startsWith("#")) setSegment("posts");
    }
  }

  return (
    <View style={styles.flex}>
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={15} color={colors.mutedForeground} />
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
              <Ionicons name="close-circle" size={15} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.searchHint}>
          Tips: &quot;exact phrase&quot;, cats OR dogs, -exclude
        </Text>
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
    <View style={styles.tabs}>
      {(["people", "posts", "clips"] as const).map((value) => {
        const active = segment === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(value)}
            style={({ pressed }) => [
              styles.tab,
              active && styles.tabActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {SEGMENT_LABELS[value]}
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

  const clipsQuery = useQuery({
    queryKey: ["search-clips", query],
    queryFn: () => searchClips(query),
    enabled: segment === "clips",
  });

  const active =
    segment === "people"
      ? peopleQuery
      : segment === "posts"
        ? postsQuery
        : clipsQuery;
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

  if (segment === "clips") {
    return (
      <View style={styles.flex}>
        {header}
        <FlatList
          data={clipsQuery.data ?? []}
          keyExtractor={(clip) => clip.id}
          keyboardShouldPersistTaps="handled"
          numColumns={CLIP_GRID_COLUMNS}
          columnWrapperStyle={styles.clipGridRow}
          renderItem={({ item }) => (
            <ClipResultTile
              clip={item}
              // No per-clip route on mobile yet, so results open post detail.
              onPress={() => router.push(`/post/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title="No clips found"
              description={`No clips match "${query}".`}
            />
          }
          contentContainerStyle={styles.clipGridContent}
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

function ClipResultTile({
  clip,
  onPress,
}: {
  clip: SearchClip;
  onPress: () => void;
}) {
  const { width } = useWindowDimensions();
  const size = (width - CLIP_GRID_GAP * (CLIP_GRID_COLUMNS - 1)) / CLIP_GRID_COLUMNS;
  const media = [...clip.post_media].sort((a, b) => a.sort_order - b.sort_order)[0];
  // Same on-device fallback as the profile grid: reels without a stored
  // thumbnail get a frame extracted locally.
  const needsFrame = !!media && !media.thumbnail_url;
  const frame = useVideoFrame(needsFrame ? media.url : null);
  const source = media ? (media.thumbnail_url ?? frame) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={clip.content ?? "Open clip"}
      onPress={onPress}
      style={({ pressed }) => [
        { width: size, height: size * (4 / 3) },
        pressed && { opacity: 0.8 },
      ]}
    >
      {source ? (
        <Image
          source={{ uri: source }}
          alt={clip.content ?? "Clip"}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.clipTilePlaceholder]} />
      )}
      <View style={styles.clipTileScrim}>
        <Ionicons name="play" size={11} color="#fff" />
        <Text style={styles.clipTileLikes}>{formatNumber(clip.like_count)}</Text>
      </View>
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
      <TrendingChips onTagPress={onTagPress} />
      <SuggestedPeople />
      <SurfaceTiles />
    </ScrollView>
  );
}

function TrendingChips({ onTagPress }: { onTagPress: (name: string) => void }) {
  const trendingQuery = useQuery({
    queryKey: ["trending-hashtags"],
    queryFn: () => getTrendingHashtags(5),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Trending</Text>
      {trendingQuery.isPending ? (
        <View style={styles.chipsRow}>
          {Array.from({ length: 3 }, (_, i) => (
            <View key={i} style={styles.skeletonChip} />
          ))}
        </View>
      ) : trendingQuery.isError ? (
        <View style={styles.sectionState}>
          <Text style={styles.sectionStateText}>Could not load trends.</Text>
          <Button
            label="Retry"
            variant="outline"
            onPress={() => trendingQuery.refetch()}
          />
        </View>
      ) : (trendingQuery.data?.length ?? 0) === 0 ? (
        <Text style={styles.sectionEmptyText}>
          Nothing trending in the last day. Post with a #tag to get one moving.
        </Text>
      ) : (
        <View style={styles.chipsRow}>
          {trendingQuery.data?.map((tag) => (
            <Pressable
              key={tag.id}
              accessibilityRole="button"
              accessibilityLabel={`Search #${tag.name}`}
              onPress={() => onTagPress(tag.name)}
              style={({ pressed }) => [styles.tagChip, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.tagChipName}>#{tag.name}</Text>
              <Text style={styles.tagChipCount}>
                {formatNumber(tag.post_count)}
              </Text>
            </Pressable>
          ))}
        </View>
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
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>People to orbit</Text>
      {suggestedQuery.isPending ? (
        <View style={styles.peopleRow}>
          {Array.from({ length: 3 }, (_, i) => (
            <View key={i} style={[styles.personCard, styles.skeletonPersonCard]}>
              <View style={styles.skeletonAvatar} />
              <View style={styles.skeletonBar} />
            </View>
          ))}
        </View>
      ) : suggestedQuery.isError ? (
        <View style={styles.sectionState}>
          <Text style={styles.sectionStateText}>Could not load suggestions.</Text>
          <Button
            label="Retry"
            variant="outline"
            onPress={() => suggestedQuery.refetch()}
          />
        </View>
      ) : (suggestedQuery.data?.length ?? 0) === 0 ? (
        <Text style={styles.sectionEmptyText}>
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
                  <Avatar url={item.avatar_url} name={item.display_name} size={72} />
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
                    following && styles.followButtonSecondary,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.followLabel,
                      following && styles.followLabelSecondary,
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

const SURFACE_TILES = [
  {
    // These routes ship in parallel changes; typed routes pick them up on
    // the next expo start, hence the Href casts below.
    path: "/communities" as Href,
    icon: "people-outline" as const,
    title: "Rooms",
  },
  {
    path: "/events" as Href,
    icon: "calendar-outline" as const,
    title: "Events",
  },
  {
    path: "/marketplace" as Href,
    icon: "storefront-outline" as const,
    title: "Market",
  },
  {
    path: "/live" as Href,
    icon: "radio-outline" as const,
    title: "Live",
  },
];

function SurfaceTiles() {
  const router = useRouter();
  return (
    <View style={styles.tilesRow}>
      {SURFACE_TILES.map((tile) => (
        <Pressable
          key={tile.title}
          accessibilityRole="button"
          accessibilityLabel={tile.title}
          onPress={() => router.push(tile.path)}
          style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name={tile.icon} size={22} color={colors.primary} />
          <Text style={styles.tileTitle}>{tile.title}</Text>
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
    paddingTop: spacing(2.5),
    paddingBottom: spacing(2),
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    minHeight: 38,
    paddingHorizontal: spacing(3),
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 14,
    paddingVertical: spacing(2),
  },
  searchHint: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: spacing(1.5),
    paddingHorizontal: spacing(3),
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing(2.5),
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: colors.foreground,
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
  clipGridRow: {
    gap: CLIP_GRID_GAP,
    marginBottom: CLIP_GRID_GAP,
  },
  clipGridContent: {
    flexGrow: 1,
    paddingTop: CLIP_GRID_GAP,
    paddingBottom: spacing(8),
  },
  clipTilePlaceholder: {
    backgroundColor: colors.surfaceElevated,
  },
  clipTileScrim: {
    position: "absolute",
    left: 6,
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderRadius: radii.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  clipTileLikes: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  homeContent: {
    paddingTop: spacing(1),
    paddingBottom: spacing(8),
    gap: spacing(5),
  },
  section: {
    paddingHorizontal: spacing(4),
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    marginBottom: spacing(2.5),
  },
  sectionState: {
    paddingVertical: spacing(3),
    alignItems: "flex-start",
    gap: spacing(3),
  },
  sectionStateText: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  sectionEmptyText: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 19,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(2),
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing(1.5),
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.full,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  tagChipName: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
  },
  tagChipCount: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  peopleRow: {
    gap: spacing(2.5),
  },
  personCard: {
    width: 128,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
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
    minHeight: 30,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  followButtonSecondary: {
    backgroundColor: colors.surfaceElevated,
  },
  followLabel: {
    color: colors.primaryForeground,
    fontSize: 12.5,
    fontWeight: "600",
  },
  followLabelSecondary: {
    color: colors.foreground,
  },
  tilesRow: {
    flexDirection: "row",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
  },
  tile: {
    flex: 1,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(1.5),
  },
  tileTitle: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "600",
  },
  skeletonChip: {
    width: 96,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonPersonCard: {
    alignItems: "center",
    gap: spacing(2.5),
    paddingVertical: spacing(4),
  },
  skeletonAvatar: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonBar: {
    width: 72,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceElevated,
  },
});
