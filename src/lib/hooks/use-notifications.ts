"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { createClient } from "@/lib/supabase/client";
import {
  getNotifications,
  getUnreadCount,
  type NotificationWithActor,
} from "@/lib/queries/notifications";

// These three hooks used to each open their own Supabase realtime channel
// AND poll every 60s. Channel + poll have been moved up to a single
// consolidated <RealtimeBridge userId={...} /> mounted once in
// (main)/layout.tsx — these hooks now just read from the React Query
// cache that the bridge invalidates.

export function useNotifications() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      if (!userId) return [] as NotificationWithActor[];
      return getNotifications(userId);
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useUnreadCount() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["unread-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      return getUnreadCount(userId);
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useUnreadMessagesCount() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["unread-messages-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      const supabase = createClient();
      const { data, error } = await supabase.rpc("unread_conversation_count", {
        p_user_id: userId,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}
