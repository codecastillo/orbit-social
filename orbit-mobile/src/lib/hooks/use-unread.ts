import { useEffect } from "react";
import { AppState } from "react-native";
import { usePathname } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getConversations } from "@/lib/queries/messages";
import { useAuth } from "@/providers/auth-provider";

const UNREAD_POLL_MS = 60_000;

export const UNREAD_MESSAGES_KEY = ["unread-messages"];
export const UNREAD_NOTIFICATIONS_KEY = ["unread-notifications"];

/**
 * Badge counts for the tab bar: unread conversations (same
 * unread_conversation_count RPC the web header uses) and unread
 * notifications (head count only, no rows). Polls every minute, refetches
 * on app foreground, and invalidates on every route change so opening a
 * conversation or the activity screen clears the badge on the way back.
 */
export function useUnreadCounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const pathname = usePathname();

  const messagesQuery = useQuery({
    queryKey: [...UNREAD_MESSAGES_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("unread_conversation_count", {
        p_user_id: user!.id,
      });
      if (error) throw error;
      const total = (data as number) ?? 0;
      // Requests wait in their own tab and must not badge the tab bar.
      // Deriving that needs the conversation list, so only reach for it when
      // there is something to subtract; the shared key reuses the messages
      // tab's copy.
      if (total === 0) return 0;
      const conversations = await queryClient.fetchQuery({
        queryKey: ["conversations", user!.id],
        queryFn: () => getConversations(user!.id),
      });
      const requests = conversations.filter(
        (c) => c.is_request && c.unread,
      ).length;
      return Math.max(0, total - requests);
    },
    enabled: !!user,
    refetchInterval: UNREAD_POLL_MS,
  });

  const notificationsQuery = useQuery({
    queryKey: [...UNREAD_NOTIFICATIONS_KEY, user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: UNREAD_POLL_MS,
  });

  // Route changes are the natural clear points: leaving a conversation or
  // the activity screen should drop the badge without waiting out the poll.
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: UNREAD_MESSAGES_KEY });
    queryClient.invalidateQueries({ queryKey: UNREAD_NOTIFICATIONS_KEY });
  }, [pathname, queryClient]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        queryClient.invalidateQueries({ queryKey: UNREAD_MESSAGES_KEY });
        queryClient.invalidateQueries({ queryKey: UNREAD_NOTIFICATIONS_KEY });
      }
    });
    return () => subscription.remove();
  }, [queryClient]);

  return {
    unreadMessages: messagesQuery.data ?? 0,
    unreadNotifications: notificationsQuery.data ?? 0,
  };
}
