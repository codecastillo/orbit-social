"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPinIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListingWithSeller } from "@/lib/queries/marketplace";

interface ListingCardProps {
  listing: ListingWithSeller;
  className?: string;
}

function formatPrice(price: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(price);
}

export function ListingCard({ listing, className }: ListingCardProps) {
  const firstImage = listing.listing_images?.sort(
    (a, b) => a.sort_order - b.sort_order
  )[0];

  return (
    <Link
      href={`/marketplace/${listing.id}`}
      className={cn(
        "group block rounded-xl overflow-hidden border border-white/5 bg-white/[0.03] backdrop-blur-sm transition-all hover:bg-white/[0.06] hover:border-white/10 hover:shadow-lg hover:shadow-primary/5",
        className
      )}
    >
      <div className="aspect-square relative bg-muted/30 overflow-hidden">
        {firstImage ? (
          <Image
            src={firstImage.url}
            alt={listing.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, 300px"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/40">
            <svg
              className="h-12 w-12"
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

      <div className="p-3 space-y-1">
        <p className="font-semibold text-base text-foreground truncate">
          {formatPrice(listing.price, listing.currency)}
        </p>
        <p className="text-sm text-muted-foreground truncate">{listing.title}</p>
        {listing.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
            <MapPinIcon className="h-3 w-3 shrink-0" />
            <span className="truncate">{listing.location}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
