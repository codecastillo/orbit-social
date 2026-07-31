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

const LISTING_SELECT = `
  *,
  profiles!listings_seller_id_fkey (
    id, username, display_name, avatar_url, is_verified
  ),
  listing_images (
    id, listing_id, url, sort_order
  )
`;

export async function getListings(category?: string, limit = 30) {
  let query = supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq("category", category);
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
