import { supabase } from "@/lib/supabase";

export type VerificationCategory =
  | "creator"
  | "business"
  | "public_figure"
  | "journalist"
  | "other";

export interface VerificationRequest {
  id: string;
  category: VerificationCategory;
  statement: string;
  evidence: string[];
  status: "pending" | "approved" | "rejected";
  decision_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export const VERIFICATION_CATEGORIES: {
  value: VerificationCategory;
  label: string;
}[] = [
  { value: "creator", label: "Creator" },
  { value: "business", label: "Business" },
  { value: "public_figure", label: "Public figure" },
  { value: "journalist", label: "Journalist" },
  { value: "other", label: "Something else" },
];

/**
 * The viewer's most recent verification request, or null if they have never
 * asked. Only one can be pending at a time, enforced by a partial unique
 * index rather than by the client checking first.
 */
export async function getMyVerificationRequest(
  userId: string,
): Promise<VerificationRequest | null> {
  const { data, error } = await supabase
    .from("verification_requests")
    .select(
      "id, category, statement, evidence, status, decision_note, reviewed_at, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as VerificationRequest) ?? null;
}

export async function submitVerificationRequest(
  userId: string,
  input: {
    category: VerificationCategory;
    statement: string;
    evidence: string[];
  },
) {
  const { error } = await supabase.from("verification_requests").insert({
    user_id: userId,
    category: input.category,
    statement: input.statement.trim(),
    evidence: input.evidence.map((link) => link.trim()).filter(Boolean),
  });
  if (error) throw error;
}

/** Withdraws a pending request. Decided ones are a record and stay. */
export async function withdrawVerificationRequest(requestId: string) {
  const { error } = await supabase
    .from("verification_requests")
    .delete()
    .eq("id", requestId);
  if (error) throw error;
}
