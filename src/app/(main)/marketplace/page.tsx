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
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-700/50">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold text-zinc-100">Exchange</h1>
          <Button onClick={() => setShowCreate(true)} size="sm" className="bg-violet-600 hover:bg-violet-500 text-white border-0 rounded-full">
            <PlusIcon className="h-4 w-4" />
            Sell
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exchange..."
              className="pl-9 bg-zinc-800 border-zinc-700/50 text-zinc-200 placeholder:text-zinc-500"
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
                "shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all border",
                activeCategory === cat
                  ? "bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-500/20"
                  : "bg-zinc-800 text-zinc-400 border-zinc-700/50 hover:bg-zinc-700 hover:text-zinc-300"
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
            <div key={i} className="rounded-xl overflow-hidden border border-zinc-700/40 bg-zinc-800/50">
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
              <Button onClick={() => setShowCreate(true)} size="sm" className="bg-violet-600 hover:bg-violet-500 text-white border-0 rounded-full">
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
