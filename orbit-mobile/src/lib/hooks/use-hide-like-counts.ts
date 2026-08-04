import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { getOwnProfile } from "@/lib/queries/profiles";

// Long staleTime: the setting only changes from the settings screen, which
// invalidates this key, same reasoning as the content-safety lists.
const VIEWER_PROFILE_STALE_MS = 30 * 60_000;

/**
 * The viewer's "hide like counts" display setting. Every card site reads
 * the one cached viewer-profile query rather than fetching per component.
 * Suppression is the caller's job, since the viewer keeps seeing the counts
 * on their own content: `hideLikeCounts && authorId !== viewerId`.
 */
export function useHideLikeCounts(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["own-profile", user?.id],
    queryFn: () => getOwnProfile(user!.id),
    enabled: !!user,
    staleTime: VIEWER_PROFILE_STALE_MS,
  });
  return data?.hide_like_counts ?? false;
}
