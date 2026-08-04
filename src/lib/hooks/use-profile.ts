"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "./use-auth";
import { createClient } from "@/lib/supabase/client";

export interface CurrentProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  is_creator: boolean;
  is_admin: boolean;
  hide_like_counts: boolean;
}

const STORAGE_KEY = (uid: string) => `current-profile:${uid}`;
const LAST_KEY = "current-profile:last";

function readCached(uid: string): CurrentProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY(uid));
    return raw ? (JSON.parse(raw) as CurrentProfile) : null;
  } catch {
    return null;
  }
}

function readLastCached(): CurrentProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as CurrentProfile) : null;
  } catch {
    return null;
  }
}

function writeCached(uid: string, profile: CurrentProfile | null) {
  if (typeof window === "undefined") return;
  try {
    if (profile) {
      window.localStorage.setItem(STORAGE_KEY(uid), JSON.stringify(profile));
      window.localStorage.setItem(LAST_KEY, JSON.stringify(profile));
    } else {
      window.localStorage.removeItem(STORAGE_KEY(uid));
    }
  } catch {
    /* swallow quota errors */
  }
}

export function useCurrentProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Hydration-safe bootstrap: server renders null, client picks up the
  // localStorage snapshot after mount. Reading synchronously in useState's
  // initializer would cause a hydration mismatch (server=null, client=cached)
  // and crash the route boundary.
  const [bootstrap, setBootstrap] = useState<CurrentProfile | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBootstrap(readLastCached());
  }, []);

  const query = useQuery<CurrentProfile | null>({
    queryKey: ["current-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, is_verified, is_creator, is_admin, hide_like_counts"
        )
        .eq("id", user.id)
        .single();
      return (data as CurrentProfile) ?? null;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
    initialData: () => (user ? readCached(user.id) ?? undefined : undefined),
  });

  // Mirror successful fetches into localStorage for next refresh.
  useEffect(() => {
    if (user && query.data) {
      writeCached(user.id, query.data);
    }
  }, [user, query.data]);

  const data = query.data ?? (user ? null : bootstrap);

  const refresh = () => {
    if (user) queryClient.invalidateQueries({ queryKey: ["current-profile", user.id] });
  };

  return { ...query, data, refresh };
}

/**
 * Viewer-level display setting: when on, like counts on OTHER people's
 * content are suppressed everywhere, while the viewer keeps seeing the
 * counts on their own posts. Reads off the one cached current-profile
 * query, so a feed of cards costs no extra requests. A localStorage
 * snapshot written before this column existed simply reads as off.
 */
export function useHideLikeCounts(): boolean {
  const { data } = useCurrentProfile();
  return data?.hide_like_counts ?? false;
}
