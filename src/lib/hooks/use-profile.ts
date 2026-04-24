"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { createClient } from "@/lib/supabase/client";

export function useCurrentProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["current-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_verified, is_creator, is_admin")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });
}
