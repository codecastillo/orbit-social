"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  MapPin,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  ImageOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatTimeAgo } from "@/lib/utils/format";
import { useAuth } from "@/lib/hooks/use-auth";
import { getOrCreateDMConversation } from "@/lib/queries/messages";
import {
  getListingById,
  type ListingWithSeller,
} from "@/lib/queries/marketplace";
import { VerifiedStar } from "@/components/orbit/verified-star";

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
  const { user } = useAuth();
  const [listing, setListing] = useState<ListingWithSeller | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [messagingSeller, setMessagingSeller] = useState(false);

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

  const handleMessageSeller = async () => {
    if (!user || !listing) return;
    setMessagingSeller(true);
    try {
      const conversationId = await getOrCreateDMConversation(
        user.id,
        listing.seller_id
      );
      router.push(`/messages/${conversationId}`);
    } catch {
      console.error("Failed to start conversation");
    } finally {
      setMessagingSeller(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-[18px]">
        <Skeleton className="h-10 w-32 rounded-full" />
        <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <p>Listing not found.</p>
      </div>
    );
  }

  const images = listing.listing_images?.sort((a, b) => a.sort_order - b.sort_order) || [];
  const hasMultiple = images.length > 1;

  return (
    <div className="flex flex-col gap-[22px] text-foreground">
      <Link
        href="/marketplace"
        className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] tracking-[0.12em] text-muted-foreground no-underline"
      >
        <ArrowLeft className="h-3 w-3" />
        BACK · MARKET
      </Link>

      <div className="grid grid-cols-1 gap-[22px] md:grid-cols-[minmax(0,1.4fr)_360px]">
        <div className="flex flex-col gap-[18px]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-surface-elevated">
            {images.length > 0 ? (
              <>
                <Image
                  src={images[currentImageIndex].url}
                  alt={listing.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 800px"
                  priority
                />
                {hasMultiple && (
                  <>
                    <button
                      onClick={() =>
                        setCurrentImageIndex((i) =>
                          i === 0 ? images.length - 1 : i - 1
                        )
                      }
                      aria-label="Previous image"
                      className="absolute left-3.5 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() =>
                        setCurrentImageIndex((i) =>
                          i === images.length - 1 ? 0 : i + 1
                        )
                      }
                      aria-label="Next image"
                      className="absolute right-3.5 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentImageIndex(i)}
                          aria-label={`Go to image ${i + 1}`}
                          className={cn(
                            "h-1.5 cursor-pointer rounded-full border-none transition-[width] duration-150",
                            i === currentImageIndex ? "bg-white" : "bg-white/50",
                          )}
                          style={{ width: i === currentImageIndex ? 18 : 6 }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-text-faint">
                <ImageOff className="h-12 w-12" strokeWidth={1} />
              </div>
            )}
          </div>

          <div>
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
              ◆&nbsp;&nbsp;LISTING
            </p>
            <h1 className="mt-2.5 text-4xl font-bold leading-tight tracking-[-0.035em]">
              {listing.title}
            </h1>
            <div className="mt-3.5 flex flex-wrap items-baseline gap-3.5">
              <span className="font-mono text-4xl leading-none text-foreground">
                {formatPrice(listing.price, listing.currency)}
              </span>
              <span className="rounded-full border border-border bg-surface px-[11px] py-[5px] font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary">
                {listing.condition}
              </span>
            </div>

            <div className="mt-3.5 flex gap-3.5 font-mono text-xs tracking-[0.04em] text-muted-foreground">
              {listing.location && (
                <span className="inline-flex items-center gap-[5px]">
                  <MapPin className="h-[11px] w-[11px]" />
                  {listing.location}
                </span>
              )}
              <span>· Posted {formatTimeAgo(listing.created_at)}</span>
            </div>

            {listing.description && (
              <p className="mt-[18px] whitespace-pre-wrap text-[14.5px] leading-[1.6] text-text-secondary">
                {listing.description}
              </p>
            )}
          </div>
        </div>

        {/* Seller rail */}
        <aside className="flex flex-col gap-3.5">
          <div className="rounded-xl border border-border bg-surface p-[22px]">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              ◇&nbsp;&nbsp;SELLER
            </p>
            <div className="mt-3 flex items-center gap-3">
              <UserAvatar
                src={listing.profiles.avatar_url}
                fallback={listing.profiles.display_name || listing.profiles.username}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="m-0 text-sm font-semibold text-foreground">
                    {listing.profiles.display_name || listing.profiles.username}
                  </p>
                  {listing.profiles.is_verified && <VerifiedStar size={12} />}
                </div>
                <p className="m-0 mt-0.5 font-mono text-[11.5px] text-muted-foreground">
                  @{listing.profiles.username}
                </p>
              </div>
            </div>
            <Button
              size="lg"
              className="mt-[18px] w-full"
              onClick={handleMessageSeller}
              disabled={
                messagingSeller || !user || user.id === listing.seller_id
              }
            >
              <MessageCircle />
              {messagingSeller ? "Opening…" : "Message seller"}
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-surface p-[18px]">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              ◈&nbsp;&nbsp;DETAILS
            </p>
            <dl className="m-0 mt-3 text-[12.5px] text-muted-foreground">
              {[
                ["Category", listing.category],
                ["Condition", listing.condition],
                ["Location", listing.location || "-"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-t border-border py-2"
                >
                  <dt className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-text-faint">
                    {label}
                  </dt>
                  <dd className="m-0 font-medium text-text-secondary">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
