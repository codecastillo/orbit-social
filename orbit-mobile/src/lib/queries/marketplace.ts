import { supabase } from "@/lib/supabase";

export interface ListingWithSeller {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  category: string;
  condition: string;
  location: string | null;
  status: "active" | "sold" | "removed" | "draft";
  view_count: number;
  created_at: string;
  updated_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
    created_at: string;
  };
  listing_images: ListingImage[];
}

export interface ListingImage {
  id: string;
  listing_id: string;
  url: string;
  sort_order: number;
}

// Mirrors the web marketplace page's chip list; "All" clears the filter.
export const LISTING_CATEGORIES = [
  "All",
  "Electronics",
  "Clothing",
  "Home",
  "Sports",
  "Other",
] as const;

// Same condition set as the web create dialog.
export const LISTING_CONDITIONS = [
  "New",
  "Like New",
  "Good",
  "Fair",
  "Poor",
] as const;

export type ListingSort = "newest" | "price_asc" | "price_desc";

export interface ListingFilters {
  search?: string;
  category?: string;
  condition?: string;
  priceMin?: number;
  priceMax?: number;
  sort?: ListingSort;
}

// Mirrors the web FTS_MIN_QUERY_LENGTH in src/lib/queries/marketplace.ts.
const FTS_MIN_QUERY_LENGTH = 3;

const LISTING_SELECT = `
  *,
  profiles!listings_seller_id_fkey (
    id, username, display_name, avatar_url, is_verified, created_at
  ),
  listing_images (
    id, listing_id, url, sort_order
  )
`;

export async function getListings(filters: ListingFilters = {}, limit = 30) {
  let query = supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("status", "active")
    .limit(limit);

  const search = filters.search?.trim();
  if (search) {
    // Same split as web searchListings so both clients match identically.
    // FTS runs on the generated listings.search_vector column over title +
    // description (GIN-indexed); websearch mode gives quoted phrases, OR,
    // and -exclusion, but has no prefix matching, so 1-2 char fragments
    // stay on the ilike substring pair. supabase-js cannot order by
    // ts_rank without an RPC, so the sort options below apply unchanged.
    if (search.length >= FTS_MIN_QUERY_LENGTH) {
      query = query.textSearch("search_vector", search, { type: "websearch" });
    } else {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
  }
  if (filters.category) {
    query = query.eq("category", filters.category);
  }
  if (filters.condition) {
    query = query.eq("condition", filters.condition);
  }
  if (filters.priceMin != null) {
    query = query.gte("price", filters.priceMin);
  }
  if (filters.priceMax != null) {
    query = query.lte("price", filters.priceMax);
  }

  if (filters.sort === "price_asc") {
    query = query.order("price", { ascending: true });
  } else if (filters.sort === "price_desc") {
    query = query.order("price", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as ListingWithSeller[];
}

export async function getListingById(listingId: string) {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", listingId)
    .single();

  if (error) throw error;
  return data as unknown as ListingWithSeller;
}

export async function createListing(
  sellerId: string,
  data: {
    title: string;
    description?: string;
    price: number;
    category: string;
    condition: string;
    imageUrls?: string[];
  },
) {
  const { data: listing, error } = await supabase
    .from("listings")
    .insert({
      seller_id: sellerId,
      title: data.title,
      description: data.description || null,
      price: data.price,
      currency: "USD",
      category: data.category,
      condition: data.condition,
      location: null,
      status: "active",
    })
    .select("id")
    .single();

  if (error) throw error;
  const created = listing as { id: string };

  if (data.imageUrls && data.imageUrls.length > 0) {
    const { error: imgError } = await supabase.from("listing_images").insert(
      data.imageUrls.map((url, i) => ({
        listing_id: created.id,
        url,
        sort_order: i,
      })),
    );
    if (imgError) throw imgError;
  }

  return created;
}

export async function uploadListingImage(
  sellerId: string,
  uri: string,
  mimeType: string,
): Promise<string> {
  const ext = mimeType.split("/")[1] ?? "jpg";
  const filePath = `${sellerId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const response = await fetch(uri);
  const body = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("listing-images")
    .upload(filePath, body, { contentType: mimeType });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("listing-images").getPublicUrl(filePath);
  return publicUrl;
}

export async function updateListingStatus(
  listingId: string,
  status: "active" | "sold" | "removed" | "draft",
) {
  const { error } = await supabase
    .from("listings")
    .update({ status })
    .eq("id", listingId);

  if (error) throw error;
}

export async function deleteListing(listingId: string) {
  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId);

  if (error) throw error;
}

// ── Saved searches ──────────────────────────────────────────────────
// Same table and shape as the web marketplace page. filters holds only the
// keys the user actually set (category, condition, priceMin, priceMax, sort)
// so a search saved here still applies its category on web. No notification
// fanout yet.

export interface SavedSearch {
  id: string;
  user_id: string;
  query: string;
  filters: Record<string, string>;
  created_at: string;
}

export async function getSavedSearches(userId: string) {
  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, user_id, query, filters, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as unknown as SavedSearch[];
}

export async function saveSearch(
  userId: string,
  query: string,
  filters: Record<string, string>,
) {
  const { data, error } = await supabase
    .from("saved_searches")
    .insert({ user_id: userId, query, filters })
    .select("id, user_id, query, filters, created_at")
    .single();

  if (error) throw error;
  return data as unknown as SavedSearch;
}

export async function deleteSavedSearch(searchId: string) {
  const { error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", searchId);

  if (error) throw error;
}

// Same RPC the web listing page uses for "Message seller": returns the
// existing DM conversation id or creates one.
export async function startDmConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc("start_dm_conversation", {
    p_other_id: otherUserId,
  });
  if (error) throw error;
  if (!data || typeof data !== "string") {
    throw new Error("start_dm_conversation returned no conversation id");
  }
  return data;
}
