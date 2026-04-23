"use client";

import { useEffect } from "react";
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { createClient } from "@/lib/supabase/client";
import {
  getConversations,
  getMessages,
  type Message,
  type ConversationWithPreview,
} from "@/lib/queries/messages";

export function useConversations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const query = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => {
      if (!user) return [] as ConversationWithPreview[];
      return getConversations(user.id);
    },
    enabled: !!user,
    staleTime: 10_000,
  });

  // Realtime subscription for conversation updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          // Refetch conversations when any message changes
          queryClient.invalidateQueries({
            queryKey: ["conversations", user.id],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, supabase]);

  return query;
}

export function useMessages(conversationId: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const query = useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: async ({ pageParam }) => {
      const messages = await getMessages(conversationId, pageParam);
      const nextCursor =
        messages.length > 0 ? messages[messages.length - 1].created_at : null;
      return { messages, nextCursor };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.messages.length > 0 ? lastPage.nextCursor : undefined,
    enabled: !!conversationId,
    staleTime: 10_000,
  });

  // Realtime subscription for new messages in this conversation
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;

          // Fetch sender profile for the new message
          const { data: sender } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .eq("id", newMessage.sender_id)
            .single();

          const messageWithSender = { ...newMessage, sender };

          // Add the new message to the query cache
          queryClient.setQueryData(
            ["messages", conversationId],
            (old: any) => {
              if (!old) return old;
              const firstPage = old.pages[0];
              if (!firstPage) return old;

              // Check if message already exists
              const allMessages = old.pages.flatMap((p: any) => p.messages);
              if (allMessages.some((m: any) => m.id === newMessage.id)) {
                return old;
              }

              return {
                ...old,
                pages: [
                  {
                    ...firstPage,
                    messages: [messageWithSender, ...firstPage.messages],
                  },
                  ...old.pages.slice(1),
                ],
              };
            }
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Message;

          queryClient.setQueryData(
            ["messages", conversationId],
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                pages: old.pages.map((page: any) => ({
                  ...page,
                  messages: page.messages.map((m: any) =>
                    m.id === updated.id ? { ...m, ...updated } : m
                  ),
                })),
              };
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient, supabase]);

  // Flatten messages from all pages and reverse so newest is at the bottom
  const messages =
    query.data?.pages.flatMap((p) => p.messages).reverse() ?? [];

  return {
    ...query,
    messages,
  };
}
