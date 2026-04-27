"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { createClient } from "@/lib/supabase/client";
import {
  getNotifications,
  getUnreadCount,
  type NotificationWithActor,
} from "@/lib/queries/notifications";

// Stable per-tab nonce so a hot-mount can't collide with a still-cleaning-up
// channel from a prior tab session.
const TAB_NONCE =
  typeof window !== "undefined"
    ? Math.random().toString(36).slice(2, 10)
    : "ssr";

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      if (!userId) return [] as NotificationWithActor[];
      return getNotifications(userId);
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channelName = `notifications:${userId}:${TAB_NONCE}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
          queryClient.invalidateQueries({ queryKey: ["unread-count", userId] });
        }
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
      } catch {
        /* ignore */
      }
      supabase.removeChannel(channel);
    };
    // Only re-subscribe when the user actually changes — queryClient is a
    // singleton so we don't need to depend on it (and including it caused
    // unnecessary re-subscribes on render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return query;
}

export function useUnreadCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["unread-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      return getUnreadCount(userId);
    },
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channelName = `sidebar-notif-count:${userId}:${TAB_NONCE}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["unread-count", userId] });
        }
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
      } catch {
        /* ignore */
      }
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return query;
}

export function useUnreadMessagesCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
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
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channelName = `unread-messages:${userId}:${TAB_NONCE}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["unread-messages-count", userId],
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_members",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["unread-messages-count", userId],
          });
        }
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
      } catch {
        /* ignore */
      }
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return query;
}
