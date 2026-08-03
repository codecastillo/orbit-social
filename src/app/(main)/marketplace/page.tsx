"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookmarkPlusIcon,
  PlusIcon,
  SearchIcon,
  ShoppingBagIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/marketplace/listing-card";
import { CreateListingDialog } from "@/components/marketplace/create-listing-dialog";
import {
  getListings,
  searchListings,
  getSavedSearches,
  saveSearch,
  deleteSavedSearch,
  type ListingWithSeller,
  type SavedSearch,
} from "@/lib/queries/marketplace";
import { useAuth } from "@/lib/hooks/use-auth";
import { Input } from "@/components/orbit/forms";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import { OrbitErrorState } from "@/components/orbit/error-state";

const CATEGORIES = ["All", "Electronics", "Clothing", "Home", "Sports", "Other"];

export default function MarketplacePage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<ListingWithSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savingSearch, setSavingSearch] = useState(false);

  useEffect(() => {
    if (!user) return;
    getSavedSearches(user.id)
      .then(setSavedSearches)
      .catch((err) => console.error("Failed to load saved searches:", err));
  }, [user]);

  const canSaveSearch =
    !!user && (searchQuery.trim().length > 0 || activeCategory !== "All");

  const handleSaveSearch = async () => {
    if (!user || !canSaveSearch) return;
    const query = searchQuery.trim();
    const filters: Record<string, string> =
      activeCategory !== "All" ? { category: activeCategory } : {};
    const duplicate = savedSearches.some(
      (s) =>
        s.query === query && (s.filters.category ?? "") === (filters.category ?? "")
    );
    if (duplicate) {
      toast.info("Already saved");
      return;
    }
    setSavingSearch(true);
    try {
      const saved = await saveSearch(user.id, query, filters);
      setSavedSearches((prev) => [saved, ...prev]);
      toast.success("Search saved");
    } catch (err) {
      console.error("Failed to save search:", err);
      toast.error("Couldn't save this search");
    } finally {
      setSavingSearch(false);
    }
  };

  const applySavedSearch = (saved: SavedSearch) => {
    setSearchQuery(saved.query);
    setActiveCategory(saved.filters.category ?? "All");
  };

  const handleDeleteSavedSearch = async (searchId: string) => {
    const prev = savedSearches;
    setSavedSearches((list) => list.filter((s) => s.id !== searchId));
    try {
      await deleteSavedSearch(searchId);
    } catch (err) {
      console.error("Failed to delete saved search:", err);
      toast.error("Couldn't delete this saved search");
      setSavedSearches(prev);
    }
  };

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
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
      setLoadError(true);
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
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search listings…"
                prefix={<SearchIcon className="h-3.5 w-3.5" />}
              />
            </div>
            {canSaveSearch && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveSearch}
                disabled={savingSearch}
              >
                <BookmarkPlusIcon className="h-3.5 w-3.5" />
                Save search
              </Button>
            )}
          </div>
          <p className="px-2 text-[11px] text-muted-foreground">
            Tips: &quot;exact phrase&quot;, bike OR scooter, -exclude
          </p>
        </div>

        {savedSearches.length > 0 && (
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-0.5">
            {savedSearches.map((saved) => {
              const label = [
                saved.query || null,
                saved.filters.category ? `in ${saved.filters.category}` : null,
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <span
                  key={saved.id}
                  className="group flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <button
                    onClick={() => applySavedSearch(saved)}
                    className="cursor-pointer py-1.5 pl-3.5"
                    title={`Search ${label}`}
                  >
                    {label}
                  </button>
                  <button
                    onClick={() => handleDeleteSavedSearch(saved.id)}
                    className="cursor-pointer rounded-full py-1.5 pl-0.5 pr-2.5 opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Delete saved search ${label}`}
                    title="Delete saved search"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

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
      ) : loadError ? (
        <OrbitErrorState
          headline="Couldn't load"
          accentWord="listings"
          sub="Something went wrong fetching the market."
          onRetry={fetchListings}
        />
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
