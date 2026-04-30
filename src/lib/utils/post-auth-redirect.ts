// Post-auth deep-link survival across the email-verification round-trip.
// `useRequireAuth` pushes signed-out users to /signup?next=<deep-link>; the
// signup page persists `next` here, then onboarding/login consume + clear it.
//
// Storage key is single-use: any consumer should clear after reading.

const KEY = "pendingPostAuthRedirect";

// Validate that a string is a same-origin pathname (no protocol, no //).
// Anything else is dropped on the floor.
export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/\\")) return null;
  return trimmed;
}

export function setPendingRedirect(next: string | null | undefined) {
  if (typeof window === "undefined") return;
  const safe = safeNext(next ?? null);
  try {
    if (safe) localStorage.setItem(KEY, safe);
    else localStorage.removeItem(KEY);
  } catch {}
}

export function consumePendingRedirect(fallback = "/feed"): string {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return safeNext(raw) ?? fallback;
  } catch {
    return fallback;
  }
}
