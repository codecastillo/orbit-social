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
    // Same ilike pair as web searchListings so both clients match identically.
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
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
