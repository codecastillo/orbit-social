"use client";

import { useState, useEffect, useCallback } from "react";
import { PlusIcon, SearchIcon, ShoppingBagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ListingCard } from "@/components/marketplace/listing-card";
import { CreateListingDialog } from "@/components/marketplace/create-listing-dialog";
import {
  getListings,
  searchListings,
  type ListingWithSeller,
} from "@/lib/queries/marketplace";
import { cn } from "@/lib/utils";

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
    <div className="border-x border-border min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold">Marketplace</h1>
          <Button onClick={() => setShowCreate(true)} size="sm">
            <PlusIcon className="h-4 w-4" />
            Sell
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search marketplace..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Listing grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-white/5">
              <Skeleton className="aspect-square w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          icon={ShoppingBagIcon}
          title="No listings found"
          description={
            searchQuery
              ? "Try a different search term."
              : "Be the first to sell something!"
          }
          action={
            !searchQuery ? (
              <Button onClick={() => setShowCreate(true)} size="sm">
                <PlusIcon className="h-4 w-4" />
                Create Listing
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4">
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
