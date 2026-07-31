import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useState } from "react";
import { Stack, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { Button, Centered, EmptyState } from "@/components/ui";
import {
  getListings,
  LISTING_CATEGORIES,
  type ListingWithSeller,
} from "@/lib/queries/marketplace";
import { colors, radii, spacing } from "@/lib/theme";

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
        <Text style={styles.cardTitle} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={styles.cardPrice}>
          {formatPrice(listing.price, listing.currency)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function MarketplaceScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const listingsQuery = useQuery({
    queryKey: ["listings", activeCategory],
    queryFn: () =>
      getListings(activeCategory === "All" ? undefined : activeCategory),
  });

  const chips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipsBar}
      contentContainerStyle={styles.chipsContent}
    >
      {LISTING_CATEGORIES.map((category) => {
        const active = category === activeCategory;
        return (
          <Pressable
            key={category}
            accessibilityRole="button"
            onPress={() => setActiveCategory(category)}
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
      <Stack.Screen options={{ title: "Marketplace" }} />
      {chips}
      {listingsQuery.isPending ? (
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
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
              title="No listings"
              description={
                activeCategory === "All"
                  ? "Items for sale will show up here."
                  : `Nothing in ${activeCategory} right now.`
              }
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  chipsBar: {
    flexGrow: 0,
  },
  chipsContent: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    gap: spacing(2),
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(1.5),
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  cardImageWrap: {
    position: "relative",
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
    padding: spacing(2.5),
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  cardPrice: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
});
