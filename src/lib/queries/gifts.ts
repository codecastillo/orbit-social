import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export type GiftType = "star" | "diamond" | "party" | "rocket" | "crown";

export interface Gift {
  type: GiftType;
  emoji: string;
  name: string;
}

export const GIFTS: Gift[] = [
  { type: "star", emoji: "\u{1F31F}", name: "Star" },
  { type: "diamond", emoji: "\u{1F48E}", name: "Diamond" },
  { type: "party", emoji: "\u{1F389}", name: "Party" },
  { type: "rocket", emoji: "\u{1F680}", name: "Rocket" },
  { type: "crown", emoji: "\u{1F451}", name: "Crown" },
];

export interface SentGift {
  id: string;
  streamId: string;
  userId: string;
  gift: Gift;
  timestamp: number;
}

export function giftByType(giftType: string): Gift | undefined {
  return GIFTS.find((g) => g.type === giftType);
}

/**
 * Send a gift on a live stream. Free to send, persisted to stream_gifts so
 * the streamer and other viewers see it (a realtime INSERT subscription on
 * the stream drives everyone else's animation).
 */
export async function sendGift(
  streamId: string,
  userId: string,
  giftType: GiftType
): Promise<SentGift> {
  const gift = giftByType(giftType);
  if (!gift) throw new Error(`Unknown gift type: ${giftType}`);

  const { data, error } = await supabase
    .from("stream_gifts")
    .insert({ stream_id: streamId, sender_id: userId, gift_type: giftType })
    .select("id, created_at")
    .single();
  if (error) throw error;

  return {
    id: data.id,
    streamId,
    userId,
    gift,
    timestamp: new Date(data.created_at).getTime(),
  };
}

export interface StreamGiftRow {
  id: string;
  gift_type: GiftType;
  created_at: string;
  sender: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export async function getRecentGifts(
  streamId: string,
  limit = 50
): Promise<StreamGiftRow[]> {
  const { data, error } = await supabase
    .from("stream_gifts")
    .select(
      "id, gift_type, created_at, sender:profiles!stream_gifts_sender_id_fkey (username, display_name, avatar_url)"
    )
    .eq("stream_id", streamId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as StreamGiftRow[];
}
