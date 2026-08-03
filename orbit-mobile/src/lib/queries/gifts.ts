import type { ComponentProps } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";

// Catalog mirrors the web gift list (src/lib/queries/gifts.ts) so both
// clients write the same gift_type values into stream_gifts. Web renders
// emoji strings; mobile renders icon glyphs instead, tinted per gift.
export type GiftType = "star" | "diamond" | "party" | "rocket" | "crown";

type GiftIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export interface Gift {
  type: GiftType;
  icon: GiftIconName;
  name: string;
  color: string;
}

export const GIFTS: Gift[] = [
  { type: "star", icon: "star", name: "Star", color: "#ffb224" },
  { type: "diamond", icon: "diamond-stone", name: "Diamond", color: "#7dd3fc" },
  { type: "party", icon: "party-popper", name: "Party", color: "#f472b6" },
  { type: "rocket", icon: "rocket-launch", name: "Rocket", color: "#ac77fa" },
  { type: "crown", icon: "crown", name: "Crown", color: "#facc15" },
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

// Same write path as the web sendGift: a direct insert into stream_gifts.
// Other viewers animate it from the realtime INSERT subscription; the
// sender animates locally from this response.
export async function sendGift(
  streamId: string,
  userId: string,
  giftType: GiftType,
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
    id: data.id as string,
    streamId,
    userId,
    gift,
    timestamp: new Date(data.created_at as string).getTime(),
  };
}
