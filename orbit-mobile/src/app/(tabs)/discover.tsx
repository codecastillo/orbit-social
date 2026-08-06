import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Alert,
  RefreshControl,
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { PostCard } from "@/components/post-card";
import { describeFilters, parseSearchQuery } from "@/lib/search-query";
import { checkUserInteractions } from "@/lib/queries/posts";
import { useHideLikeCounts } from "@/lib/hooks/use-hide-like-counts";
import { Avatar, Button, EmptyState } from "@/components/ui";
import {
  checkFollowingMany,
  checkFollowStates,
  toggleFollowState,
  type FollowState,
} from "@/lib/queries/profiles";
import {
  clearRecentSearches,
  getRecentSearches,
  recentSearchLabel,
  rememberSearchQuery,
  rememberVisitedUser,
  removeRecentSearch,
  type RecentSearch,
} from "@/lib/recent-searches";
import {
  followPackMembers,
  getActiveStarterPacks,
  type StarterPack,
} from "@/lib/queries/starter-packs";
import {
  getSuggestedUsers,
  getTrendingHashtags,
  searchClips,
  searchLiked,
  searchMessages,
  searchPostsAdvanced,
  searchSaved,
  searchUsers,
  type ProfileSummary,
  type SearchClip,
} from "@/lib/queries/search";
import { useVideoFrame } from "@/lib/video-frame";
import { formatNumber, formatTimeAgo } from "@/lib/format";
import { colors, radii, spacing } from "@/lib/theme";

const SEARCH_DEBOUNCE_MS = 300;
const CLIP_GRID_GAP = 1;
const CLIP_GRID_COLUMNS = 3;

type Segment = "people" | "posts" | "clips" | "messages" | "saved" | "liked";

const SEGMENT_LABELS: Record<Segment, string> = {
  people: "People",
  posts: "Posts",
  clips: "Clips",
  messages: "Messages",
  saved: "Saved",
  liked: "Liked",
};

// The last three search the viewer's own things, so they are pointless when
// signed out and are filtered from the bar there.
const OWN_SEGMENTS: Segment[] = ["messages", "saved", "liked"];

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function DiscoverScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("people");
  const debouncedQuery = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);
  const isSearching = debouncedQuery.length > 0;

  const [recents, setRecents] = useState<RecentSearch[]>([]);
  useEffect(() => {
    void getRecentSearches().then(setRecents);
  }, []);

  // Recording the debounced value, not every keystroke, keeps the list to
  // searches the user actually settled on.
  useEffect(() => {
    if (debouncedQuery.length === 0) return;
    void rememberSearchQuery(debouncedQuery).then(setRecents);
  }, [debouncedQuery]);

  function openRecent(entry: RecentSearch) {
    if (entry.kind === "user") {
      router.push(`/user/${entry.value}`);
      return;
    }
    if (entry.kind === "hashtag") setSegment("posts");
    setQuery(recentSearchLabel(entry));
  }

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
      </View>
      {isSearching ? (
        <SearchResults
          query={debouncedQuery}
          segment={segment}
          onSegmentChange={setSegment}
          onOpenPerson={(username) =>
            void rememberVisitedUser(username).then(setRecents)
          }
        />
      ) : (
        <DiscoverHome
          onTagPress={(name) => {
            setSegment("posts");
            setQuery(`#${name}`);
          }}
          recents={recents}
          onSelectRecent={openRecent}
          onRemoveRecent={(entry) =>
            void removeRecentSearch(entry).then(setRecents)
          }
          onClearRecents={() => void clearRecentSearches().then(setRecents)}
        />
      )}
    </View>
  );
}

function SegmentedControl({
  segment,
  onChange,
  segments,
}: {
  segment: Segment;
  onChange: (segment: Segment) => void;
  segments: Segment[];
}) {
  return (
    // Six segments do not fit a fixed row on a phone, so the bar scrolls the
    // same way the profile tabs do.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabs}
    >
      {segments.map((value) => {
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
    </ScrollView>
  );
}

function SearchResults({
  query,
  segment,
  onSegmentChange,
  onOpenPerson,
}: {
  query: string;
  segment: Segment;
  onSegmentChange: (segment: Segment) => void;
  /** Records a profile the viewer opened from these results. */
  onOpenPerson: (username: string) => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  // Operators are parsed once here and every search below acts on the parts,
  // so "from:@dan has:image beach" narrows rather than being searched for
  // literally.
  const parsed = useMemo(() => parseSearchQuery(query), [query]);
  const filterSummary = describeFilters(parsed);
  const visibleSegments: Segment[] = user
    ? (Object.keys(SEGMENT_LABELS) as Segment[])
    : (Object.keys(SEGMENT_LABELS) as Segment[]).filter(
        (value) => !OWN_SEGMENTS.includes(value),
      );

  const peopleQuery = useQuery({
    queryKey: ["search-users", query],
    queryFn: () => searchUsers(parsed.text || query),
    enabled: segment === "people",
  });

  const postsQuery = useQuery({
    queryKey: ["search-posts", query],
    queryFn: () => searchPostsAdvanced(parsed),
    enabled: segment === "posts",
  });

  const messagesQuery = useQuery({
    queryKey: ["search-messages", query, user?.id],
    queryFn: () => searchMessages(parsed),
    enabled: segment === "messages" && !!user,
  });

  const savedQuery = useQuery({
    queryKey: ["search-saved", query, user?.id],
    queryFn: () => searchSaved(user!.id, parsed),
    enabled: segment === "saved" && !!user,
  });

  const likedQuery = useQuery({
    queryKey: ["search-liked", query, user?.id],
    queryFn: () => searchLiked(user!.id, parsed),
    enabled: segment === "liked" && !!user,
  });

  const clipsQuery = useQuery({
    queryKey: ["search-clips", query],
    queryFn: () => searchClips(parsed.text || query),
    enabled: segment === "clips",
  });

  // Same one-lookup-per-page shape as the follow states below: the cards
  // need the viewer's own likes and bookmarks to render their filled state.
  const postResultIds = (postsQuery.data ?? []).map((post) => post.id);
  const { data: postInteractions } = useQuery({
    queryKey: ["post-interactions", user?.id, postResultIds],
    queryFn: () => checkUserInteractions(user!.id, postResultIds),
    enabled: !!user && postResultIds.length > 0,
  });

  // One lookup for the whole result page, so every row shows the right
  // Follow / Requested / Following label without a round trip of its own.
  const peopleIds = (peopleQuery.data ?? []).map((person) => person.id);
  const followStatesQuery = useQuery({
    queryKey: ["search-follow-states", user?.id, peopleIds],
    queryFn: () => checkFollowStates(user!.id, peopleIds),
    enabled: !!user && peopleIds.length > 0,
  });

  // Rows the viewer has acted on this session; where a tap lands depends on
  // whether the target is private, so it comes back from the write.
  const [followEdits, setFollowEdits] = useState<
    Readonly<Record<string, FollowState>>
  >({});

  async function toggleFollow(targetId: string, current: FollowState) {
    if (!user) return;
    try {
      const next = await toggleFollowState(user.id, targetId, current);
      setFollowEdits((prev) => ({ ...prev, [targetId]: next }));
    } catch {
      Alert.alert("Couldn't update follow");
    }
  }

  // One entry per segment rather than a ternary chain; six segments made the
  // nested form unreadable.
  const bySegment = {
    people: peopleQuery,
    posts: postsQuery,
    clips: clipsQuery,
    messages: messagesQuery,
    saved: savedQuery,
    liked: likedQuery,
  } as const;
  const active = bySegment[segment];
  const refreshControl = (
    <RefreshControl
      refreshing={active.isRefetching}
      onRefresh={() => active.refetch()}
      tintColor={colors.mutedForeground}
    />
  );
  const header = (
    <View>
      <SegmentedControl
        segments={visibleSegments}
        segment={segment}
        onChange={onSegmentChange}
      />
      {/* Says what the operators were understood to mean. Without it a typo
          in "form:@dan" silently searches for the word instead. */}
      {filterSummary.length > 0 ? (
        <Text style={styles.filterSummary}>
          Filtering {filterSummary.join(", ")}
        </Text>
      ) : null}
    </View>
  );

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
          refreshControl={refreshControl}
          renderItem={({ item }) => {
            const followState =
              followEdits[item.id] ??
              followStatesQuery.data?.get(item.id) ??
              "none";
            return (
              <PersonRow
                person={item}
                followState={followState}
                canFollow={!!user && item.id !== user.id}
                onToggleFollow={() => toggleFollow(item.id, followState)}
                onPress={() => {
                  onOpenPerson(item.username);
                  router.push(`/user/${item.username}`);
                }}
              />
            );
          }}
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
          refreshControl={refreshControl}
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

  if (segment === "messages") {
    return (
      <View style={styles.flex}>
        {header}
        <FlatList
          data={messagesQuery.data ?? []}
          keyExtractor={(hit) => hit.id}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open conversation with ${item.sender?.username ?? "unknown"}`}
              onPress={() => router.push(`/conversation/${item.conversation_id}`)}
              style={({ pressed }) => [
                styles.messageHit,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={styles.messageHitSender} numberOfLines={1}>
                {item.sender?.display_name ?? item.sender?.username ?? "Unknown"}
              </Text>
              <Text style={styles.messageHitBody} numberOfLines={2}>
                {item.content}
              </Text>
              <Text style={styles.messageHitTime}>
                {formatTimeAgo(item.created_at)}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No messages found"
              description={
                parsed.text
                  ? `No message matches "${parsed.text}".`
                  : "Type something to search your conversations."
              }
            />
          }
        />
      </View>
    );
  }

  const postRows =
    segment === "saved"
      ? (savedQuery.data ?? [])
      : segment === "liked"
        ? (likedQuery.data ?? [])
        : (postsQuery.data ?? []);

  return (
    <View style={styles.flex}>
      {header}
      <FlatList
        data={postRows}
        keyExtractor={(post) => post.id}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUserId={user!.id}
            isLiked={postInteractions?.likedPostIds.has(item.id) ?? false}
            isBookmarked={postInteractions?.bookmarkedPostIds.has(item.id) ?? false}
            isReposted={postInteractions?.repostedPostIds.has(item.id) ?? false}
            surface={query.startsWith("#") ? "hashtag" : "search"}
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
  followState,
  canFollow,
  onToggleFollow,
  onPress,
}: {
  person: ProfileSummary;
  followState: FollowState;
  canFollow: boolean;
  onToggleFollow: () => void;
  onPress: () => void;
}) {
  const isActive = followState !== "none";
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
      {canFollow ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            followState === "following"
              ? `Unfollow @${person.username}`
              : followState === "requested"
                ? `Cancel follow request to @${person.username}`
                : `Follow @${person.username}`
          }
          onPress={onToggleFollow}
          style={({ pressed }) => [
            styles.followButton,
            styles.rowFollowButton,
            isActive && styles.followButtonSecondary,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text
            style={[styles.followLabel, isActive && styles.followLabelSecondary]}
          >
            {followState === "following"
              ? "Following"
              : followState === "requested"
                ? "Requested"
                : "Follow"}
          </Text>
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      )}
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
  const { user } = useAuth();
  const hideLikeCounts = useHideLikeCounts();
  const showLikeCount = !hideLikeCounts || clip.user_id === user?.id;
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
        styles.clipTile,
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
          cachePolicy="memory-disk"
          recyclingKey={source}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.clipTilePlaceholder]} />
      )}
      <View style={styles.clipTileScrim}>
        <Ionicons name="play" size={11} color="#fff" />
        {showLikeCount ? (
          <Text style={styles.clipTileLikes}>{formatNumber(clip.like_count)}</Text>
        ) : null}
        {media?.duration_ms ? (
          <Text style={styles.clipTileDuration}>
            {formatClipDuration(media.duration_ms)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function formatClipDuration(durationMs: number): string {
  const total = Math.round(durationMs / 1000);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

function DiscoverHome({
  onTagPress,
  recents,
  onSelectRecent,
  onRemoveRecent,
  onClearRecents,
}: {
  onTagPress: (name: string) => void;
  recents: RecentSearch[];
  onSelectRecent: (entry: RecentSearch) => void;
  onRemoveRecent: (entry: RecentSearch) => void;
  onClearRecents: () => void;
}) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // The sections below own their own queries, so a pull refreshes them by
  // key rather than by threading four refetch callbacks through here.
  async function refreshSections() {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trending-hashtags"] }),
        queryClient.invalidateQueries({ queryKey: ["suggested-users"] }),
        queryClient.invalidateQueries({ queryKey: ["starter-packs-active"] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.homeContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshSections}
          tintColor={colors.mutedForeground}
        />
      }
    >
      <RecentSearchChips
        recents={recents}
        onSelect={onSelectRecent}
        onRemove={onRemoveRecent}
        onClearAll={onClearRecents}
      />
      {/* Navigation first. These are destinations, not suggestions, and
          below three sections that are empty on a young account they read
          as leftovers stranded at the bottom of the page. */}
      <SurfaceTiles />
      <TrendingChips onTagPress={onTagPress} />
      <SuggestedPeople />
      <StarterPacksRail />
    </ScrollView>
  );
}

function RecentSearchChips({
  recents,
  onSelect,
  onRemove,
  onClearAll,
}: {
  recents: RecentSearch[];
  onSelect: (entry: RecentSearch) => void;
  onRemove: (entry: RecentSearch) => void;
  onClearAll: () => void;
}) {
  if (recents.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.recentHeader}>
        <Text style={styles.sectionTitle}>Recent</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onClearAll}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.clearAllLabel}>Clear all</Text>
        </Pressable>
      </View>
      <View style={styles.chipsRow}>
        {recents.map((entry) => {
          const label = recentSearchLabel(entry);
          return (
            <View key={`${entry.kind}:${entry.value}`} style={styles.recentChip}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Search ${label} again`}
                onPress={() => onSelect(entry)}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.recentChipLabel} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${label} from recent searches`}
                onPress={() => onRemove(entry)}
                hitSlop={8}
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="close" size={13} color={colors.mutedForeground} />
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Each section below reserves the height of its loaded state so the whole
// page composes in final position from the first frame. Without this the
// sections drop in as their queries resolve and everything under them
// slides down twice.
// Heading line plus its 10pt bottom margin.
const SECTION_TITLE_HEIGHT = 28;
// Two rows of 34pt chips plus the 8pt gap between them.
const TRENDING_BODY_HEIGHT = 76;
// Person card: 24 padding, 72 avatar, name, handle, 30 follow button.
const PEOPLE_BODY_HEIGHT = 178;
// Pack card: 24 padding, title, two description lines, avatar row, button.
const PACKS_BODY_HEIGHT = 158;

function TrendingChips({ onTagPress }: { onTagPress: (name: string) => void }) {
  const trendingQuery = useQuery({
    queryKey: ["trending-hashtags"],
    queryFn: () => getTrendingHashtags(5),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <View
      style={[
        styles.section,
        // Height is reserved only while the answer is unknown. Holding it
        // after an empty result leaves a hole the size of content that is
        // never coming.
        trendingQuery.isPending && styles.trendingSection,
      ]}
    >
      <Text style={styles.sectionTitle}>Trending</Text>
      {trendingQuery.isPending ? (
        <View style={styles.chipsRow}>
          {Array.from({ length: 6 }, (_, i) => (
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
  // Local follow state per card. Where a tap lands depends on whether the
  // target is private, so it comes back from the write rather than a guess.
  const [followStates, setFollowStates] = useState<
    Readonly<Record<string, FollowState>>
  >({});

  const suggestedQuery = useQuery({
    queryKey: ["suggested-users", user?.id],
    queryFn: () => getSuggestedUsers(user!.id, 8),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  async function toggleFollow(targetId: string) {
    if (!user) return;
    const current = followStates[targetId] ?? "none";
    try {
      const next = await toggleFollowState(user.id, targetId, current);
      setFollowStates((prev) => ({ ...prev, [targetId]: next }));
    } catch {
      Alert.alert("Couldn't update follow");
    }
  }

  return (
    <View
      style={[
        styles.section,
        suggestedQuery.isPending && styles.peopleSection,
      ]}
    >
      <Text style={styles.sectionTitle}>People to orbit</Text>
      {suggestedQuery.isPending ? (
        // The loaded state is a horizontal rail, so the skeleton has to be
        // one too: a column of cards here would tower over the real content
        // and collapse the moment the query lands.
        <View style={[styles.peopleRow, styles.skeletonRow]}>
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
            const followState = followStates[item.id] ?? "none";
            const isActive = followState !== "none";
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
                    isActive && styles.followButtonSecondary,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.followLabel,
                      isActive && styles.followLabelSecondary,
                    ]}
                  >
                    {followState === "following"
                      ? "Following"
                      : followState === "requested"
                        ? "Requested"
                        : "Follow"}
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

const PACK_AVATARS_SHOWN = 4;

/**
 * Curated follow bundles, the same ones the onboarding step offers, kept
 * reachable afterwards for people who skipped them or joined before they
 * existed. A pack drops out once the viewer follows everyone in it.
 */
function StarterPacksRail() {
  const { user } = useAuth();
  // Members the viewer has dealt with this session: followed outright, or
  // requested if the account is private. Either way the pack has nothing left
  // to offer for them, but only the first kind counts as a follow.
  const [handledIds, setHandledIds] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState(false);

  // getActiveStarterPacks returns [] on any error, so a missing table just
  // hides the rail.
  const packsQuery = useQuery({
    queryKey: ["starter-packs-active"],
    queryFn: getActiveStarterPacks,
    staleTime: 1000 * 60 * 10,
  });

  const memberIds = [
    ...new Set(
      (packsQuery.data ?? []).flatMap((pack) => pack.members.map((m) => m.id)),
    ),
  ];

  const followsQuery = useQuery({
    queryKey: ["starter-pack-follows", user?.id, memberIds.length],
    queryFn: () => checkFollowingMany(user!.id, memberIds),
    enabled: !!user && memberIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  if (!user) return null;

  // Both queries have to land before the rail knows whether it has anything
  // to show, so it holds its height meanwhile. A rail with nothing left to
  // offer still collapses once, but the common case composes in place.
  if (packsQuery.isPending || (memberIds.length > 0 && followsQuery.isPending)) {
    return <View style={styles.packsSkeleton} />;
  }

  if (memberIds.length === 0) return null;
  // The follow graph decides which packs still have something to offer, so
  // without it the rail stays hidden rather than pitching stale packs.
  if (followsQuery.isError) return null;

  const remaining = (pack: StarterPack) =>
    pack.members
      .map((m) => m.id)
      .filter(
        (id) =>
          id !== user.id &&
          !handledIds.has(id) &&
          !(followsQuery.data?.has(id) ?? false),
      );

  const openPacks = (packsQuery.data ?? []).filter(
    (pack) => remaining(pack).length > 0,
  );
  if (openPacks.length === 0) return null;

  async function followAll(pack: StarterPack) {
    if (!user) return;
    const ids = remaining(pack);
    if (ids.length === 0) return;
    setFailed(false);
    try {
      const result = await followPackMembers(user.id, ids);
      setHandledIds(
        (prev) => new Set([...prev, ...result.followed, ...result.requested]),
      );
      if (result.requested.length > 0) {
        Alert.alert(
          `Following ${result.followed.length} from ${pack.title}`,
          `${result.requested.length} private ${result.requested.length === 1 ? "account is" : "accounts are"} pending approval.`,
        );
      }
    } catch {
      setFailed(true);
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Starter packs</Text>
      {failed ? (
        <Text style={styles.sectionStateText}>
          Couldn&apos;t follow right now. Try again.
        </Text>
      ) : null}
      <FlatList
        horizontal
        data={openPacks}
        keyExtractor={(pack) => pack.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.packsRow}
        renderItem={({ item }) => (
          <View style={styles.packCard}>
            <Text style={styles.packTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.description ? (
              <Text style={styles.packDescription} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <View style={styles.packMembers}>
              {item.members.slice(0, PACK_AVATARS_SHOWN).map((member) => (
                <View key={member.id} style={styles.packAvatar}>
                  <Avatar
                    url={member.avatar_url}
                    name={member.display_name}
                    size={26}
                  />
                </View>
              ))}
              <Text style={styles.packCount}>{item.members.length}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Follow everyone in ${item.title}`}
              onPress={() => followAll(item)}
              style={({ pressed }) => [
                styles.followButton,
                styles.packFollowButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.followLabel}>Follow all</Text>
            </Pressable>
          </View>
        )}
      />
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
  filterSummary: {
    color: colors.mutedForeground,
    fontSize: 12,
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(2),
  },
  messageHit: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  messageHitSender: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  messageHitBody: {
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 2,
  },
  messageHitTime: {
    color: colors.textFaint,
    fontSize: 11.5,
    marginTop: 3,
  },
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
  clipGridRow: {
    gap: CLIP_GRID_GAP,
    marginBottom: CLIP_GRID_GAP,
  },
  clipGridContent: {
    flexGrow: 1,
    paddingTop: CLIP_GRID_GAP,
    paddingBottom: spacing(8),
  },
  clipTile: {
    // Flat placeholder under the thumbnail, so a tile that has not decoded
    // yet reads as a filled slot instead of a gap in the grid.
    backgroundColor: colors.surfaceElevated,
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
  clipTileDuration: {
    marginLeft: "auto",
    color: "#fff",
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    opacity: 0.85,
  },
  homeContent: {
    paddingTop: spacing(1),
    paddingBottom: spacing(8),
    gap: spacing(5),
  },
  section: {
    paddingHorizontal: spacing(4),
  },
  trendingSection: {
    minHeight: SECTION_TITLE_HEIGHT + TRENDING_BODY_HEIGHT,
  },
  peopleSection: {
    minHeight: SECTION_TITLE_HEIGHT + PEOPLE_BODY_HEIGHT,
  },
  packsSkeleton: {
    height: SECTION_TITLE_HEIGHT + PACKS_BODY_HEIGHT,
  },
  skeletonRow: {
    flexDirection: "row",
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
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clearAllLabel: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: spacing(2.5),
  },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    maxWidth: "100%",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.full,
    paddingLeft: spacing(3),
    paddingRight: spacing(2.5),
    paddingVertical: spacing(2),
  },
  recentChipLabel: {
    color: colors.foreground,
    fontSize: 13,
    maxWidth: 200,
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
  // The card variant stacks under an avatar; in a search row it sits inline.
  rowFollowButton: {
    marginTop: 0,
    paddingHorizontal: spacing(3.5),
  },
  followLabel: {
    color: colors.primaryForeground,
    fontSize: 12.5,
    fontWeight: "600",
  },
  followLabelSecondary: {
    color: colors.foreground,
  },
  packsRow: {
    gap: spacing(2.5),
  },
  packCard: {
    width: 220,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing(3),
  },
  packTitle: {
    color: colors.foreground,
    fontSize: 13.5,
    fontWeight: "600",
  },
  packDescription: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  packMembers: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing(2.5),
  },
  // Overlapping stack, with the card colour as the ring between avatars.
  packAvatar: {
    marginRight: -8,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  packCount: {
    color: colors.mutedForeground,
    fontSize: 11.5,
    marginLeft: spacing(3),
  },
  packFollowButton: {
    paddingHorizontal: spacing(3),
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
