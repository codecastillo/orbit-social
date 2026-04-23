import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

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

const LISTING_SELECT = `
  *,
  profiles!listings_seller_id_fkey (
    id, username, display_name, avatar_url, is_verified
  ),
  listing_images (
    id, listing_id, url, sort_order
  )
`;

export async function getListings(
  category?: string,
  cursor?: string,
  limit = 20
) {
  let query = supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq("category", category);
  }

  if (cursor) {
    query = query.lt("created_at", cursor);
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
    currency?: string;
    category: string;
    condition: string;
    location?: string;
    imageUrls?: string[];
  }
) {
  const { data: listing, error } = await supabase
    .from("listings")
    .insert({
      seller_id: sellerId,
      title: data.title,
      description: data.description || null,
      price: data.price,
      currency: data.currency || "USD",
      category: data.category,
      condition: data.condition,
      location: data.location || null,
      status: "active",
    })
    .select(LISTING_SELECT)
    .single();

  if (error) throw error;

  if (data.imageUrls && data.imageUrls.length > 0 && listing) {
    const imageInserts = data.imageUrls.map((url, i) => ({
      listing_id: listing.id,
      url,
      sort_order: i,
    }));

    const { error: imgError } = await supabase
      .from("listing_images")
      .insert(imageInserts);

    if (imgError) throw imgError;
  }

  return listing;
}

export async function uploadListingImage(
  sellerId: string,
  file: File
): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const filePath = `${sellerId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("listing-images")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("listing-images").getPublicUrl(filePath);

  return publicUrl;
}

export async function updateListingStatus(
  listingId: string,
  status: "active" | "sold" | "removed" | "draft"
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

export async function searchListings(
  query: string,
  category?: string,
  limit = 20
) {
  let dbQuery = supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("status", "active")
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category) {
    dbQuery = dbQuery.eq("category", category);
  }

  const { data, error } = await dbQuery;
  if (error) throw error;
  return data as unknown as ListingWithSeller[];
}
