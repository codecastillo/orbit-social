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
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatTimeAgo } from "@/lib/utils/format";
import { useAuth } from "@/lib/hooks/use-auth";
import { getOrCreateDMConversation } from "@/lib/queries/messages";
import {
  getListingById,
  type ListingWithSeller,
} from "@/lib/queries/marketplace";
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
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
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Skeleton className="h-10 w-32 rounded-full" />
        <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: O.ink3 }}>
        <p>Listing not found.</p>
      </div>
    );
  }

  const images = listing.listing_images?.sort((a, b) => a.sort_order - b.sort_order) || [];
  const hasMultiple = images.length > 1;

  return (
    <div style={{ color: O.ink, fontFamily: O.sans, display: "flex", flexDirection: "column", gap: 22 }}>
      <Link
        href="/marketplace"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: O.ink3,
          fontFamily: O.mono,
          fontSize: 11,
          letterSpacing: "0.12em",
          textDecoration: "none",
          width: "fit-content",
        }}
      >
        <ArrowLeft style={{ width: 12, height: 12 }} />
        BACK · MARKET
      </Link>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) 360px",
          gap: 22,
        }}
        className="md:grid-cols-[minmax(0,1.4fr)_360px] grid-cols-1"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              ...panel({ borderRadius: 22 }),
              padding: 0,
              overflow: "hidden",
              position: "relative",
              aspectRatio: "4 / 3",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            {images.length > 0 ? (
              <>
                <Image
                  src={images[currentImageIndex].url}
                  alt={listing.title}
                  fill
                  style={{ objectFit: "cover" }}
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
                      style={{
                        position: "absolute",
                        left: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.55)",
                        backdropFilter: "blur(20px)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <ChevronLeft style={{ width: 16, height: 16 }} />
                    </button>
                    <button
                      onClick={() =>
                        setCurrentImageIndex((i) =>
                          i === images.length - 1 ? 0 : i + 1
                        )
                      }
                      style={{
                        position: "absolute",
                        right: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.55)",
                        backdropFilter: "blur(20px)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <ChevronRight style={{ width: 16, height: 16 }} />
                    </button>
                    <div
                      style={{
                        position: "absolute",
                        bottom: 16,
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        gap: 6,
                      }}
                    >
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentImageIndex(i)}
                          style={{
                            width: i === currentImageIndex ? 18 : 6,
                            height: 6,
                            borderRadius: 99,
                            border: "none",
                            background:
                              i === currentImageIndex
                                ? "white"
                                : "rgba(255,255,255,0.5)",
                            cursor: "pointer",
                            transition: "width 150ms ease",
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: O.ink4,
                }}
              >
                <ImageOff style={{ width: 48, height: 48 }} strokeWidth={1} />
              </div>
            )}
          </div>

          <div>
            <Eyebrow accent>◆&nbsp;&nbsp;LISTING</Eyebrow>
            <Display size={36} style={{ marginTop: 10 }}>
              {listing.title}
            </Display>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 14,
                marginTop: 14,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontFamily: O.serif,
                  fontStyle: "italic",
                  fontSize: 36,
                  color: O.a3,
                  lineHeight: 1,
                }}
              >
                {formatPrice(listing.price, listing.currency)}
              </span>
              <span
                style={{
                  padding: "5px 11px",
                  borderRadius: 99,
                  background: O.glass,
                  border: `1px solid ${O.hair2}`,
                  fontSize: 11,
                  fontFamily: O.mono,
                  color: O.ink2,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {listing.condition}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                gap: 14,
                marginTop: 14,
                fontSize: 12,
                color: O.ink3,
                fontFamily: O.mono,
                letterSpacing: "0.04em",
              }}
            >
              {listing.location && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <MapPin style={{ width: 11, height: 11 }} />
                  {listing.location}
                </span>
              )}
              <span>· Posted {formatTimeAgo(listing.created_at)}</span>
            </div>

            {listing.description && (
              <p
                style={{
                  fontSize: 14.5,
                  color: O.ink2,
                  lineHeight: 1.6,
                  marginTop: 18,
                  whiteSpace: "pre-wrap",
                }}
              >
                {listing.description}
              </p>
            )}
          </div>
        </div>

        {/* Seller rail */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...panel({ borderRadius: 20 }), padding: 22 }}>
            <Eyebrow>◇&nbsp;&nbsp;SELLER</Eyebrow>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <UserAvatar
                src={listing.profiles.avatar_url}
                fallback={listing.profiles.display_name || listing.profiles.username}
                size="lg"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: O.ink }}>
                    {listing.profiles.display_name || listing.profiles.username}
                  </p>
                  {listing.profiles.is_verified && <VerifiedStar size={12} />}
                </div>
                <p
                  style={{
                    fontSize: 11.5,
                    color: O.ink3,
                    margin: "2px 0 0",
                    fontFamily: O.mono,
                  }}
                >
                  @{listing.profiles.username}
                </p>
              </div>
            </div>
            <PillBtn
              primary
              size="lg"
              onClick={handleMessageSeller}
              disabled={
                messagingSeller || !user || user.id === listing.seller_id
              }
              style={{ width: "100%", justifyContent: "center", marginTop: 18 }}
            >
              <MessageCircle style={{ width: 14, height: 14 }} />
              {messagingSeller ? "Opening…" : "Message seller"}
            </PillBtn>
          </div>

          <div style={{ ...panel({ borderRadius: 18 }), padding: 18 }}>
            <Eyebrow>◈&nbsp;&nbsp;DETAILS</Eyebrow>
            <dl style={{ margin: "12px 0 0", fontSize: 12.5, color: O.ink3 }}>
              {[
                ["Category", listing.category],
                ["Condition", listing.condition],
                ["Location", listing.location || "—"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderTop: `1px solid ${O.hair}`,
                  }}
                >
                  <dt
                    style={{
                      fontFamily: O.mono,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontSize: 10.5,
                      color: O.ink4,
                    }}
                  >
                    {label}
                  </dt>
                  <dd style={{ margin: 0, color: O.ink2, fontWeight: 500 }}>
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
