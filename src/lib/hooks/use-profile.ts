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

  // Read the last-known profile synchronously on mount so the sidebar can
  // paint the user's avatar/name before useAuth resolves the session.
  // This eliminates the "You / @you" flash on every refresh.
  const [bootstrap] = useState<CurrentProfile | null>(() => readLastCached());

  const query = useQuery<CurrentProfile | null>({
    queryKey: ["current-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, is_verified, is_creator, is_admin"
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
