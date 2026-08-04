"use client";

import { useEffect, useRef } from "react";
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
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

  // Realtime subscription for conversation updates. Postgres changes can't
  // filter this down to conversations the user belongs to, so we listen to
  // message INSERTs table-wide and coalesce bursts: at most one refetch per
  // 2s window instead of one per message platform-wide.
  const invalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;

    const scheduleInvalidate = () => {
      if (invalidateTimer.current) return;
      invalidateTimer.current = setTimeout(() => {
        invalidateTimer.current = null;
        queryClient.invalidateQueries({
          queryKey: ["conversations", user.id],
        });
      }, 2000);
    };

    const channel = supabase
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        scheduleInvalidate
      )
      .subscribe();

    return () => {
      if (invalidateTimer.current) {
        clearTimeout(invalidateTimer.current);
        invalidateTimer.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, supabase]);

  return query;
}

/** One page of the thread, oldest-first cursor over messages.created_at. */
interface MessagePage {
  messages: Message[];
  nextCursor: string | null;
}

type MessagesCache = InfiniteData<MessagePage, string | undefined>;

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
            (old: MessagesCache | undefined) => {
              if (!old) return old;
              const firstPage = old.pages[0];
              if (!firstPage) return old;

              const allMessages = old.pages.flatMap((p) => p.messages);
              // Already present (dedupe by real id)
              if (allMessages.some((m) => m.id === newMessage.id)) {
                return old;
              }
              // Reconcile against an optimistic temp row from the same sender
              // with identical content. If we find one, swap it in place
              // instead of prepending a duplicate bubble.
              const tempMatch = allMessages.find(
                (m) =>
                  typeof m.id === "string" &&
                  m.id.startsWith("temp-") &&
                  m.sender_id === newMessage.sender_id &&
                  m.content === newMessage.content
              );
              if (tempMatch) {
                return {
                  ...old,
                  pages: old.pages.map((page) => ({
                    ...page,
                    messages: page.messages.map((m) =>
                      m.id === tempMatch.id ? messageWithSender : m
                    ),
                  })),
                };
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
            (old: MessagesCache | undefined) => {
              if (!old) return old;
              return {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  messages: page.messages.map((m) =>
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
