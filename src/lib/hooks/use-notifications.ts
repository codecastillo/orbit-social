"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { createClient } from "@/lib/supabase/client";
import {
  getNotifications,
  getUnreadCount,
  type NotificationWithActor,
} from "@/lib/queries/notifications";
import { getConversations } from "@/lib/queries/messages";

// These three hooks used to each open their own Supabase realtime channel
// AND poll every 60s. Channel + poll have been moved up to a single
// consolidated <RealtimeBridge userId={...} /> mounted once in
// (main)/layout.tsx, these hooks now just read from the React Query
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
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["unread-messages-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      const supabase = createClient();
      const { data, error } = await supabase.rpc("unread_conversation_count", {
        p_user_id: userId,
      });
      if (error) throw error;
      const total = (data as number) ?? 0;
      // Requests wait in their own tab and must not badge the nav. Deriving
      // that needs the conversation list, so only reach for it when there is
      // something to subtract; the shared key reuses the messages tab's copy.
      if (total === 0) return 0;
      const conversations = await queryClient.fetchQuery({
        queryKey: ["conversations", userId],
        queryFn: () => getConversations(userId),
        staleTime: 10_000,
      });
      const requests = conversations.filter(
        (c) => c.is_request && c.unread
      ).length;
      return Math.max(0, total - requests);
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}
