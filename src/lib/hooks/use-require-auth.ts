"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "./use-auth";

// Returns a guard fn. Call it at the top of any handler that needs auth:
//
//   const requireAuth = useRequireAuth();
//   const handleLike = async () => {
//     if (!requireAuth()) return;
//     // ...
//   };
//
// Signed-out callers get pushed to /signup?next=<current-url>; the signup
// flow round-trips that path through localStorage so the user lands back on
// the same deep link after onboarding.
export function useRequireAuth() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  return () => {
    if (user) return true;
    const qs = search.toString();
    const next = qs ? `${pathname}?${qs}` : pathname;
    router.push(`/signup?next=${encodeURIComponent(next)}`);
    return false;
  };
}
