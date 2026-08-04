import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState } from "@/components/ui";
import {
  countActiveFilters,
  DEFAULT_MARKETPLACE_FILTERS,
  MarketplaceFilterSheet,
  type MarketplaceFilters,
} from "@/components/marketplace-filter-sheet";
import {
  deleteSavedSearch,
  getListings,
  getSavedSearches,
  LISTING_CATEGORIES,
  saveSearch,
  type ListingFilters,
  type ListingSort,
  type ListingWithSeller,
  type SavedSearch,
} from "@/lib/queries/marketplace";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing } from "@/lib/theme";

// Same debounce the web marketplace page applies to its search input.
const SEARCH_DEBOUNCE_MS = 300;

function parsePrice(text: string): number | undefined {
  const value = Number.parseFloat(text);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

// Only the keys the user actually set go into saved_searches.filters, so a
// search saved here still applies its category on web (which only reads
// query and category).
function filtersToRecord(filters: MarketplaceFilters): Record<string, string> {
  const record: Record<string, string> = {};
  if (filters.category !== "All") record.category = filters.category;
  if (filters.condition) record.condition = filters.condition;
  if (filters.priceMin.trim()) record.priceMin = filters.priceMin.trim();
  if (filters.priceMax.trim()) record.priceMax = filters.priceMax.trim();
  if (filters.sort !== "newest") record.sort = filters.sort;
  return record;
}

function recordToFilters(record: Record<string, string>): MarketplaceFilters {
  return {
    category: record.category ?? "All",
    condition: record.condition ?? null,
    priceMin: record.priceMin ?? "",
    priceMax: record.priceMax ?? "",
    sort: (record.sort as ListingSort | undefined) ?? "newest",
  };
}

function savedSearchLabel(saved: SavedSearch): string {
  const parts = [saved.query || null];
  if (saved.filters.category) parts.push(`in ${saved.filters.category}`);
  const extras = ["condition", "priceMin", "priceMax", "sort"].filter(
    (key) => saved.filters[key],
  ).length;
  if (extras > 0) parts.push(`+${extras}`);
  return parts.filter(Boolean).join(" ");
}

function formatPrice(price: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

function ListingCard({
  listing,
  onPress,
}: {
  listing: ListingWithSeller;
  onPress: () => void;
}) {
  const images = [...listing.listing_images].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const firstImage = images[0];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.cardImageWrap}>
        {firstImage ? (
          <Image
            source={{ uri: firstImage.url }}
            alt={listing.title}
            style={styles.cardImage}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            recyclingKey={firstImage.url}
          />
        ) : (
          <View style={[styles.cardImage, styles.cardImageFallback]} />
        )}
        {listing.status === "sold" ? (
          <View style={styles.soldOverlay}>
            <Text style={styles.soldLabel}>SOLD</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardPrice}>
          {formatPrice(listing.price, listing.currency)}
        </Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {listing.title}
        </Text>
      </View>
    </Pressable>
  );
}

export default function MarketplaceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<MarketplaceFilters>(
    DEFAULT_MARKETPLACE_FILTERS,
  );
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedSearch(searchText.trim()),
      searchText ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(timeout);
  }, [searchText]);

  const queryFilters: ListingFilters = {
    search: debouncedSearch || undefined,
    category: filters.category === "All" ? undefined : filters.category,
    condition: filters.condition ?? undefined,
    priceMin: parsePrice(filters.priceMin),
    priceMax: parsePrice(filters.priceMax),
    sort: filters.sort,
  };

  const listingsQuery = useQuery({
    queryKey: ["listings", queryFilters],
    queryFn: () => getListings(queryFilters),
  });

  const activeFilterCount = countActiveFilters(filters);

  const savedSearchesKey = ["saved-searches", user?.id];
  const savedSearchesQuery = useQuery({
    queryKey: savedSearchesKey,
    queryFn: () => getSavedSearches(user!.id),
    enabled: !!user,
  });
  const savedSearches = savedSearchesQuery.data ?? [];

  const canSaveSearch =
    !!user && (debouncedSearch.length > 0 || activeFilterCount > 0);

  const save = useMutation({
    mutationFn: () =>
      saveSearch(user!.id, debouncedSearch, filtersToRecord(filters)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: savedSearchesKey }),
    onError: () => Alert.alert("Couldn't save this search"),
  });

  const removeSaved = useMutation({
    mutationFn: (searchId: string) => deleteSavedSearch(searchId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: savedSearchesKey }),
    onError: () => Alert.alert("Couldn't delete this saved search"),
  });

  const handleSaveSearch = () => {
    if (!canSaveSearch || save.isPending) return;
    const record = filtersToRecord(filters);
    const duplicate = savedSearches.some(
      (s) =>
        s.query === debouncedSearch &&
        JSON.stringify(s.filters) === JSON.stringify(record),
    );
    if (duplicate) {
      Alert.alert("Already saved");
      return;
    }
    save.mutate();
  };

  const applySavedSearch = (saved: SavedSearch) => {
    setSearchText(saved.query);
    setFilters(recordToFilters(saved.filters));
  };

  const confirmDeleteSaved = (saved: SavedSearch) => {
    Alert.alert(`Delete "${savedSearchLabel(saved)}"?`, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => removeSaved.mutate(saved.id),
      },
    ]);
  };

  const searchBar = (
    <View style={styles.searchRow}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search listings"
          placeholderTextColor={colors.textFaint}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {searchText.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setSearchText("")}
            hitSlop={8}
          >
            <Ionicons
              name="close-circle"
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open filters"
        onPress={() => setFiltersOpen(true)}
        style={({ pressed }) => [
          styles.filterButton,
          activeFilterCount > 0 && styles.filterButtonActive,
          pressed && { opacity: 0.8 },
        ]}
      >
        <Ionicons
          name="options-outline"
          size={18}
          color={
            activeFilterCount > 0 ? colors.primaryForeground : colors.foreground
          }
        />
        {activeFilterCount > 0 ? (
          <Text style={styles.filterCount}>{activeFilterCount}</Text>
        ) : null}
      </Pressable>
      {canSaveSearch ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save this search"
          onPress={handleSaveSearch}
          disabled={save.isPending}
          style={({ pressed }) => [
            styles.filterButton,
            (pressed || save.isPending) && { opacity: 0.8 },
          ]}
        >
          <Ionicons
            name="bookmark-outline"
            size={18}
            color={colors.foreground}
          />
        </Pressable>
      ) : null}
    </View>
  );

  const savedChips =
    savedSearches.length > 0 ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsBar}
        contentContainerStyle={styles.savedChipsContent}
      >
        {savedSearches.map((saved) => (
          <Pressable
            key={saved.id}
            accessibilityRole="button"
            accessibilityLabel={`Apply saved search ${savedSearchLabel(saved)}`}
            accessibilityHint="Long press to delete"
            onPress={() => applySavedSearch(saved)}
            onLongPress={() => confirmDeleteSaved(saved)}
            style={({ pressed }) => [
              styles.savedChip,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons
              name="bookmark"
              size={12}
              color={colors.mutedForeground}
            />
            <Text style={styles.savedChipLabel} numberOfLines={1}>
              {savedSearchLabel(saved)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    ) : null;

  const chips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipsBar}
      contentContainerStyle={styles.chipsContent}
    >
      {LISTING_CATEGORIES.map((category) => {
        const active = category === filters.category;
        return (
          <Pressable
            key={category}
            accessibilityRole="button"
            onPress={() => setFilters((prev) => ({ ...prev, category }))}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
              {category}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: "Marketplace",
          headerRight: () => <CreateListingHeaderButton />,
        }}
      />
      {searchBar}
      <Text style={styles.searchHint}>
        Tips: &quot;exact phrase&quot;, bike OR scooter, -exclude
      </Text>
      {savedChips}
      {chips}
      {listingsQuery.isPending ? (
        <View style={styles.listContent}>
          {Array.from({ length: 3 }, (_, row) => (
            <View key={row} style={styles.gridRow}>
              <View style={styles.skeletonCard} />
              <View style={styles.skeletonCard} />
            </View>
          ))}
        </View>
      ) : listingsQuery.isError ? (
        <EmptyState
          title="Could not load listings"
          description="Check your connection and try again."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => listingsQuery.refetch()}
            />
          }
        />
      ) : (
        <FlatList
          data={listingsQuery.data}
          keyExtractor={(listing) => listing.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          refreshControl={
            <RefreshControl
              refreshing={listingsQuery.isRefetching}
              onRefresh={() => listingsQuery.refetch()}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() => router.push(`/marketplace/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title={
                debouncedSearch || activeFilterCount > 0
                  ? "No matches"
                  : "No listings"
              }
              description={
                debouncedSearch || activeFilterCount > 0
                  ? "Try a different search term or filters."
                  : "Items for sale will show up here."
              }
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
      <MarketplaceFilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onApply={setFilters}
      />
    </View>
  );
}

function CreateListingHeaderButton() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Create a listing"
      onPress={() => router.push("/marketplace/create")}
      hitSlop={8}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
    >
      <Ionicons name="add" size={26} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    minHeight: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(3),
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
    paddingHorizontal: spacing(4),
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
    minHeight: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(2.5),
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterCount: {
    color: colors.primaryForeground,
    fontSize: 12,
    fontWeight: "700",
  },
  chipsBar: {
    flexGrow: 0,
  },
  savedChipsContent: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    gap: spacing(2),
  },
  savedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    maxWidth: 220,
  },
  savedChipLabel: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  chipsContent: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    gap: spacing(2),
  },
  chip: {
    borderRadius: radii.full,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipLabel: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontWeight: "600",
  },
  chipLabelActive: {
    color: colors.primaryForeground,
  },
  listContent: {
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(10),
    flexGrow: 1,
  },
  gridRow: {
    gap: spacing(3),
    marginBottom: spacing(3),
  },
  card: {
    flex: 1,
  },
  cardImageWrap: {
    position: "relative",
    borderRadius: 10,
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    aspectRatio: 1,
  },
  cardImageFallback: {
    backgroundColor: colors.surfaceElevated,
  },
  soldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 11, 13, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  soldLabel: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  cardBody: {
    paddingTop: spacing(2),
    paddingHorizontal: spacing(0.5),
  },
  cardPrice: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
  },
  cardTitle: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 1,
  },
  skeletonCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
  },
});
