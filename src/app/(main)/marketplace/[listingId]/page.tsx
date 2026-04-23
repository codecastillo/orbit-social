"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeftIcon,
  MapPinIcon,
  MessageCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatTimeAgo } from "@/lib/utils/format";
import {
  getListingById,
  type ListingWithSeller,
} from "@/lib/queries/marketplace";

function formatPrice(price: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(price);
}

export default function ListingDetailPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = use(params);
  const router = useRouter();
  const [listing, setListing] = useState<ListingWithSeller | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const data = await getListingById(listingId);
        setListing(data);
      } catch (err) {
        console.error("Failed to load listing:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [listingId]);

  if (loading) {
    return (
      <div className="border-x border-border min-h-screen">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-6 w-6" />
        </div>
        <Skeleton className="aspect-square w-full" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="border-x border-border min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Listing not found</p>
      </div>
    );
  }

  const images = listing.listing_images?.sort(
    (a, b) => a.sort_order - b.sort_order
  ) || [];
  const hasMultipleImages = images.length > 1;

  return (
    <div className="border-x border-border min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 p-4 border-b border-border bg-background/80 backdrop-blur-xl">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold truncate">Listing</h1>
      </div>

      {/* Image carousel */}
      <div className="relative aspect-square bg-muted/20">
        {images.length > 0 ? (
          <>
            <Image
              src={images[currentImageIndex].url}
              alt={listing.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 600px"
              priority
            />
            {hasMultipleImages && (
              <>
                <button
                  onClick={() =>
                    setCurrentImageIndex((i) =>
                      i === 0 ? images.length - 1 : i - 1
                    )
                  }
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() =>
                    setCurrentImageIndex((i) =>
                      i === images.length - 1 ? 0 : i + 1
                    )
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
                {/* Dots */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentImageIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === currentImageIndex
                          ? "w-4 bg-white"
                          : "w-1.5 bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground/30">
            <svg
              className="h-20 w-20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-4 space-y-4">
        {/* Price + condition */}
        <div className="flex items-center justify-between">
          <p className="text-2xl font-bold">
            {formatPrice(listing.price, listing.currency)}
          </p>
          <Badge variant="secondary">{listing.condition}</Badge>
        </div>

        <h2 className="text-lg font-semibold">{listing.title}</h2>

        {/* Location + time */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {listing.location && (
            <div className="flex items-center gap-1">
              <MapPinIcon className="h-3.5 w-3.5" />
              <span>{listing.location}</span>
            </div>
          )}
          <span>Posted {formatTimeAgo(listing.created_at)} ago</span>
        </div>

        {/* Description */}
        {listing.description && (
          <div className="pt-2 border-t border-white/5">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {listing.description}
            </p>
          </div>
        )}

        {/* Seller */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            <UserAvatar
              src={listing.profiles.avatar_url}
              fallback={listing.profiles.display_name || listing.profiles.username}
              size="md"
            />
            <div>
              <p className="font-medium text-sm">
                {listing.profiles.display_name || listing.profiles.username}
              </p>
              <p className="text-xs text-muted-foreground">
                @{listing.profiles.username}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <MessageCircleIcon className="h-4 w-4" />
            Message Seller
          </Button>
        </div>
      </div>
    </div>
  );
}
