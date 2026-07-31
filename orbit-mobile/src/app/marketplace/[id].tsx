import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, Button, Centered, EmptyState } from "@/components/ui";
import { getListingById, startDmConversation } from "@/lib/queries/marketplace";
import { colors, radii, spacing } from "@/lib/theme";

function formatPrice(price: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [activeImage, setActiveImage] = useState(0);

  const listingQuery = useQuery({
    queryKey: ["listing", id],
    queryFn: () => getListingById(id),
    enabled: !!id,
  });
  const listing = listingQuery.data;

  const messageSeller = useMutation({
    mutationFn: () => startDmConversation(listing!.seller_id),
    onSuccess: (conversationId) => {
      router.push(`/conversation/${conversationId}`);
    },
  });

  if (listingQuery.isPending) {
    return (
      <>
        <Stack.Screen options={{ title: "Listing" }} />
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      </>
    );
  }

  if (listingQuery.isError || !listing) {
    return (
      <>
        <Stack.Screen options={{ title: "Listing" }} />
        <EmptyState
          title="Could not load this listing"
          description="It may have been removed, or your connection dropped."
          action={
            <Button
              label="Retry"
              variant="outline"
              onPress={() => listingQuery.refetch()}
            />
          }
        />
      </>
    );
  }

  const images = [...listing.listing_images].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const isOwnListing = user?.id === listing.seller_id;

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: listing.title }} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={listingQuery.isRefetching}
            onRefresh={() => listingQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setActiveImage(
                  Math.round(e.nativeEvent.contentOffset.x / width),
                )
              }
            >
              {images.map((image) => (
                <Image
                  key={image.id}
                  source={{ uri: image.url }}
                  alt={listing.title}
                  style={{ width, height: width }}
                  contentFit="cover"
                  transition={150}
                />
              ))}
            </ScrollView>
            {images.length > 1 ? (
              <View style={styles.dots}>
                {images.map((image, index) => (
                  <View
                    key={image.id}
                    style={[styles.dot, index === activeImage && styles.dotActive]}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.imageFallback, { width, height: width * 0.6 }]} />
        )}

        <View style={styles.body}>
          <Text style={styles.title}>{listing.title}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {formatPrice(listing.price, listing.currency)}
            </Text>
            {listing.status === "sold" ? (
              <View style={styles.soldBadge}>
                <Text style={styles.soldBadgeLabel}>Sold</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>{listing.condition}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>{listing.category}</Text>
            </View>
          </View>

          {listing.description ? (
            <Text style={styles.description}>{listing.description}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/user/${listing.profiles.username}`)}
            style={({ pressed }) => [styles.sellerCard, pressed && { opacity: 0.8 }]}
          >
            <Avatar
              url={listing.profiles.avatar_url}
              name={listing.profiles.display_name}
              size={40}
            />
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>
                {listing.profiles.display_name}
              </Text>
              <Text style={styles.sellerUsername}>
                @{listing.profiles.username}
              </Text>
            </View>
          </Pressable>

          {!isOwnListing && user ? (
            <View style={styles.messageButton}>
              <Button
                label="Message seller"
                loading={messageSeller.isPending}
                onPress={() => messageSeller.mutate()}
              />
              {messageSeller.isError ? (
                <Text style={styles.messageError}>
                  Could not open the conversation. Try again.
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing(10),
  },
  imageFallback: {
    backgroundColor: colors.surfaceElevated,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing(1.5),
    marginTop: spacing(2.5),
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  body: {
    padding: spacing(4),
  },
  title: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    marginTop: spacing(1.5),
  },
  price: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "700",
  },
  soldBadge: {
    backgroundColor: colors.destructive,
    borderRadius: radii.full,
    paddingHorizontal: spacing(2.5),
    paddingVertical: 3,
  },
  soldBadgeLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing(2),
    marginTop: spacing(3),
  },
  badge: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing(2.5),
    paddingVertical: 3,
  },
  badgeLabel: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing(4),
  },
  sellerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing(3),
    marginTop: spacing(5),
  },
  sellerInfo: {
    marginLeft: spacing(2.5),
  },
  sellerName: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  sellerUsername: {
    color: colors.mutedForeground,
    fontSize: 12.5,
    marginTop: 1,
  },
  messageButton: {
    marginTop: spacing(4),
  },
  messageError: {
    color: colors.destructive,
    fontSize: 12.5,
    marginTop: spacing(2),
    textAlign: "center",
  },
});
