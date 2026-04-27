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

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [] as NotificationWithActor[];
      return getNotifications(user.id);
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Realtime subscription. Channel name is randomized per mount so a re-run
  // (e.g. when `user` flips from null → user) never collides with the prior
  // not-yet-cleaned-up channel — supabase-js otherwise reuses the cached
  // RealtimeChannel and throws "cannot add postgres_changes callbacks after
  // subscribed".
  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
          queryClient.invalidateQueries({ queryKey: ["unread-count", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

export function useUnreadCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["unread-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      return getUnreadCount(user.id);
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  // Live updates regardless of which page is mounted — the sidebar lives in
  // the root layout so this subscription stays alive across navigations.
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`sidebar-notif-count:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["unread-count", user.id],
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

export function useUnreadMessagesCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["unread-messages-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const supabase = createClient();
      const { data, error } = await supabase.rpc("unread_conversation_count", {
        p_user_id: user.id,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  // Realtime: any new message or read receipt change should invalidate the count
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    const messagesChannel = supabase
      .channel(`unread-messages:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["unread-messages-count", user.id],
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_members", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["unread-messages-count", user.id],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [user, queryClient]);

  return query;
}
