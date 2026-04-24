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
      <div className="sticky top-0 z-10 bg-zinc-950/60 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
              <ShoppingBagIcon className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Exchange</h1>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            size="sm"
            className="rounded-full py-2.5 px-5 h-auto font-medium bg-gradient-to-r from-violet-600 to-cyan-500 text-white border-0 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:brightness-110 transition-all"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            Sell
          </Button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exchange..."
              className="pl-10 h-10 rounded-full bg-white/[0.05] border-white/[0.08] text-zinc-200 placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all"
            />
          </div>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 px-5 pb-4 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-all border",
                activeCategory === cat
                  ? "bg-violet-600/90 text-white border-violet-400/30 shadow-[0_0_12px_rgba(139,92,246,0.3)]"
                  : "bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:bg-white/[0.08] hover:text-zinc-300"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Listing grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl">
              <Skeleton className="aspect-square w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="p-5">
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl p-10">
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
                  <Button
                    onClick={() => setShowCreate(true)}
                    size="sm"
                    className="rounded-full px-5 bg-gradient-to-r from-violet-600 to-cyan-500 text-white border-0 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:brightness-110 transition-all"
                  >
                    <PlusIcon className="h-4 w-4 mr-1.5" />
                    Create Listing
                  </Button>
                ) : undefined
              }
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-5">
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
