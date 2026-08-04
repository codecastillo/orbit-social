/**
 * Server-side block enforcement surfaces as two distinct Postgres failures,
 * and both reach the client as raw database errors. These predicates turn
 * them into copy a person can read. Mirrors src/lib/utils/blocked-error.ts
 * on web.
 */

// RAISE EXCEPTION from the messages BEFORE INSERT trigger.
const POSTGRES_RAISE_EXCEPTION = "P0001";
// WITH CHECK violation on the follows INSERT policy.
const POSTGRES_RLS_VIOLATION = "42501";

export const BLOCKED_DM_MESSAGE = "You can't message this account";
export const BLOCKED_FOLLOW_MESSAGE = "You can't follow this account";
export const MESSAGE_NOT_ALLOWED_MESSAGE =
  "This account isn't accepting messages";

function errorField(error: unknown, field: "code" | "message"): string {
  if (typeof error !== "object" || error === null || !(field in error)) return "";
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

/** True for the `blocked` exception the DM trigger raises on a blocked pair. */
export function isBlockedDmError(error: unknown): boolean {
  return (
    errorField(error, "code") === POSTGRES_RAISE_EXCEPTION &&
    errorField(error, "message").toLowerCase().includes("blocked")
  );
}

/**
 * True for the `message_not_allowed` exception the DM trigger raises when the
 * recipient's "who can message you" rule refuses first contact.
 */
export function isMessageNotAllowedError(error: unknown): boolean {
  return (
    errorField(error, "code") === POSTGRES_RAISE_EXCEPTION &&
    errorField(error, "message").includes("message_not_allowed")
  );
}

/**
 * True for a rejected follow insert. The policy's other condition is
 * `auth.uid() = follower_id`, which every follow action already satisfies,
 * so a violation here means the two accounts are blocked.
 */
export function isBlockedFollowError(error: unknown): boolean {
  return errorField(error, "code") === POSTGRES_RLS_VIOLATION;
}
