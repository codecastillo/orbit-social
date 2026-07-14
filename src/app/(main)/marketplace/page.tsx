"use client";

import { useState, useEffect, useCallback } from "react";
import { PlusIcon, SearchIcon, ShoppingBagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/marketplace/listing-card";
import { CreateListingDialog } from "@/components/marketplace/create-listing-dialog";
import {
  getListings,
  searchListings,
  type ListingWithSeller,
} from "@/lib/queries/marketplace";
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
    <div className="flex flex-col gap-[22px] text-foreground">
      <div className="flex flex-wrap items-end justify-between gap-[18px]">
        <div>
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
            ◈&nbsp;&nbsp;MARKET · OPEN
          </p>
          <h1 className="mt-2 text-[56px] font-bold leading-none tracking-[-0.035em]">
            Things, <span className="text-primary">traded</span>.
          </h1>
          <p className="mt-2.5 max-w-[540px] text-[14.5px] leading-[1.55] text-muted-foreground">
            Hand-me-down economy. From people you already orbit.
          </p>
        </div>
        <Button size="lg" onClick={() => setShowCreate(true)}>
          <PlusIcon />
          List something
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search listings…"
          prefix={<SearchIcon className="h-3.5 w-3.5" />}
        />

        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-0.5">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "shrink-0 cursor-pointer rounded-full border px-4 py-2 text-[12.5px] font-semibold transition-colors",
                  active
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-border bg-surface"
            >
              <Skeleton className="aspect-square w-full" />
              <div className="flex flex-col gap-2 p-3.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <OrbitEmptyState
          icon={ShoppingBagIcon}
          accent="var(--primary)"
          headline={searchQuery ? "No" : "Quiet"}
          accentWord={searchQuery ? "matches" : "shelves"}
          sub={
            searchQuery
              ? "Try a different search term or category."
              : "Nothing listed yet. Put something up, someone in your orbit is probably looking."
          }
          ctaLabel={!searchQuery ? "List something" : undefined}
          ctaIcon={<PlusIcon className="h-3 w-3" />}
          onCta={!searchQuery ? () => setShowCreate(true) : undefined}
        />
      ) : (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
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
