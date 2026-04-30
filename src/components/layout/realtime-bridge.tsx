"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// Consolidated realtime subscription for the signed-in user. Replaces three
// separate channels (notifications + unread-count + unread-messages-count)
// with a single channel that fans out to React Query invalidations.
//
// Mounted once at the (main) layout level. The hooks themselves
// (useNotifications, useUnreadCount, useUnreadMessagesCount) keep their
// useQuery calls but no longer open per-hook subscriptions.
export function RealtimeBridge({ userId }: { userId: string | null }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    // Single channel name keyed on user; collisions with stale subscriptions
    // are avoided by Supabase auto-numbering identical names per connection.
    const channel = supabase.channel(`user-bridge:${userId}`);

    channel
      // Notifications: any change to my notifications row → refresh the list
      // and the unread badge.
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
        },
      )
      // Any new message anywhere → recompute my unread-conversation count.
      // Filter-by-conversation isn't expressible in PostgREST realtime
      // (membership requires a join), so the RPC handles the membership
      // check on read.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["unread-messages-count", userId],
          });
        },
      )
      // I marked a conversation read — bump my unread badge.
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
        },
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
    // queryClient is stable; only re-subscribe when userId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return null;
}
