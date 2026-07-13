"use client";

import { useState, useEffect, useCallback } from "react";
import { PlusIcon, SearchIcon, ShoppingBagIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingCard } from "@/components/marketplace/listing-card";
import { CreateListingDialog } from "@/components/marketplace/create-listing-dialog";
import {
  getListings,
  searchListings,
  type ListingWithSeller,
} from "@/lib/queries/marketplace";
import { O } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { Input } from "@/components/orbit/forms";
import { OrbitEmptyState } from "@/components/orbit/empty-state";

const CATEGORIES = ["All", "Electronics", "Clothing", "Home", "Sports", "Other"];

export default function MarketplacePage() {
  const [listings, setListings] = useState<ListingWithSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const category = activeCategory === "All" ? undefined : activeCategory;
      if (searchQuery.trim()) {
        const data = await searchListings(searchQuery.trim(), category);
        setListings(data);
      } else {
        const data = await getListings(category);
        setListings(data);
      }
    } catch (err) {
      console.error("Failed to load listings:", err);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    const timeout = setTimeout(fetchListings, searchQuery ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [fetchListings, searchQuery]);

  return (
    <div style={{ color: O.ink, fontFamily: O.sans, display: "flex", flexDirection: "column", gap: 22 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Eyebrow accent>◈&nbsp;&nbsp;MARKET · OPEN</Eyebrow>
          <Display size={56} style={{ marginTop: 8 }}>
            Things, <Acc>traded</Acc>.
          </Display>
          <p style={{ fontSize: 14.5, color: O.ink3, marginTop: 10, lineHeight: 1.55, maxWidth: 540 }}>
            Hand-me-down economy. From people you already orbit.
          </p>
        </div>
        <PillBtn primary size="lg" onClick={() => setShowCreate(true)}>
          <PlusIcon style={{ width: 14, height: 14 }} />
          List something
        </PillBtn>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search listings…"
          prefix={<SearchIcon style={{ width: 14, height: 14 }} />}
        />

        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 2,
          }}
          className="no-scrollbar"
        >
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  flexShrink: 0,
                  padding: "8px 16px",
                  borderRadius: 99,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: active
                    ? `linear-gradient(135deg, color-mix(in oklab, ${O.a1} 15%, transparent) 0%, color-mix(in oklab, ${O.a2} 12%, transparent) 55%, color-mix(in oklab, ${O.a3} 15%, transparent) 100%)`
                    : O.glass,
                  border: `1px solid ${active ? O.hair2 : O.hair}`,
                  color: active ? O.ink : O.ink3,
                  fontFamily: O.sans,
                  transition: "all 150ms cubic-bezier(0.16,1,0.3,1)",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                borderRadius: 18,
                overflow: "hidden",
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${O.hair}`,
              }}
            >
              <Skeleton className="aspect-square w-full" />
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <OrbitEmptyState
          icon={ShoppingBagIcon}
          accent="#7dffa3"
          headline={searchQuery ? "No" : "Quiet"}
          accentWord={searchQuery ? "matches" : "shelves"}
          sub={
            searchQuery
              ? "Try a different search term or category."
              : "Nothing listed yet. Put something up, someone in your orbit is probably looking."
          }
          ctaLabel={!searchQuery ? "List something" : undefined}
          ctaIcon={<PlusIcon style={{ width: 12, height: 12 }} />}
          onCta={!searchQuery ? () => setShowCreate(true) : undefined}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      <CreateListingDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={fetchListings}
      />
    </div>
  );
}
