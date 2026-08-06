import { supabase } from "@/lib/supabase";

export interface MonetizationConfig {
  payments_enabled: boolean;
  min_tip_cents: number;
  max_tip_cents: number;
}

export interface CreatorMonetization {
  user_id: string;
  tips_enabled: boolean;
  subscription_price_cents: number | null;
  payout_status: "none" | "pending" | "ready";
}

/**
 * The gateway switch. Every monetization surface asks this first, so nothing
 * that could take money appears while the answer is false.
 *
 * The column is world-readable and writable by nobody through the API:
 * turning payments on is a deliberate act by someone with database access,
 * the same shape as the feed ranking switch.
 */
export async function getMonetizationConfig(): Promise<MonetizationConfig> {
  const { data, error } = await supabase
    .from("monetization_config")
    .select("payments_enabled, min_tip_cents, max_tip_cents")
    .maybeSingle();
  // A missing or unreadable row means off. Failing open here would show
  // people a way to pay that cannot work.
  if (error || !data) {
    return { payments_enabled: false, min_tip_cents: 100, max_tip_cents: 50000 };
  }
  return data as MonetizationConfig;
}

export async function getCreatorMonetization(
  userId: string,
): Promise<CreatorMonetization | null> {
  const { data, error } = await supabase
    .from("creator_monetization")
    .select("user_id, tips_enabled, subscription_price_cents, payout_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as CreatorMonetization) ?? null;
}

/**
 * Saves a creator's intent. Allowed while payments are off on purpose: they
 * can decide what they would charge before anyone can pay it, and the row is
 * inert until the gateway exists.
 */
export async function saveCreatorMonetization(
  userId: string,
  patch: { tipsEnabled?: boolean; subscriptionPriceCents?: number | null },
) {
  const { error } = await supabase.from("creator_monetization").upsert(
    {
      user_id: userId,
      ...(patch.tipsEnabled !== undefined
        ? { tips_enabled: patch.tipsEnabled }
        : {}),
      ...(patch.subscriptionPriceCents !== undefined
        ? { subscription_price_cents: patch.subscriptionPriceCents }
        : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
