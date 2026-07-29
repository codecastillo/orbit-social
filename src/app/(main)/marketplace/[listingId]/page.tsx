import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ListingContent } from "./listing-content";

interface Props {
  params: Promise<{ listingId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { listingId } = await params;
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("title, price, currency, description, listing_images(url, sort_order)")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing) return { title: { absolute: "Not found · Orbit" } };

  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: listing.currency || "USD",
    minimumFractionDigits: 2,
  }).format(listing.price);
  const description = listing.description
    ? `${price} · ${listing.description.slice(0, 140)}`
    : `${price} on Orbit Marketplace.`;
  const firstImage = [...(listing.listing_images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  )[0]?.url;

  return {
    title: `${listing.title} · ${price}`,
    description,
    alternates: { canonical: `/marketplace/${listingId}` },
    openGraph: {
      title: `${listing.title} · ${price}`,
      description,
      ...(firstImage ? { images: [firstImage] } : {}),
    },
  };
}

export default async function ListingDetailPage({ params }: Props) {
  const { listingId } = await params;
  return <ListingContent listingId={listingId} />;
}
