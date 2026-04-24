export type GiftType = "star" | "diamond" | "party" | "rocket" | "crown";

export interface Gift {
  type: GiftType;
  emoji: string;
  name: string;
  points: number;
}

export const GIFTS: Gift[] = [
  { type: "star", emoji: "\u{1F31F}", name: "Star", points: 10 },
  { type: "diamond", emoji: "\u{1F48E}", name: "Diamond", points: 50 },
  { type: "party", emoji: "\u{1F389}", name: "Party", points: 100 },
  { type: "rocket", emoji: "\u{1F680}", name: "Rocket", points: 500 },
  { type: "crown", emoji: "\u{1F451}", name: "Crown", points: 1000 },
];

export interface SentGift {
  id: string;
  streamId: string;
  userId: string;
  gift: Gift;
  timestamp: number;
}

let giftCounter = 0;

/**
 * Send a gift on a live stream.
 * Currently visual-only — no real currency or database persistence.
 * Returns a SentGift object for rendering the animation.
 */
export function sendGift(
  streamId: string,
  userId: string,
  giftType: GiftType
): SentGift {
  const gift = GIFTS.find((g) => g.type === giftType);
  if (!gift) throw new Error(`Unknown gift type: ${giftType}`);

  giftCounter += 1;

  return {
    id: `gift-${Date.now()}-${giftCounter}`,
    streamId,
    userId,
    gift,
    timestamp: Date.now(),
  };
}
