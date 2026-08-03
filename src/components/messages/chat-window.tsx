"use client";

import { useEffect, useRef, useState } from "react";
import { MessageBubble, type QuotedReply } from "./message-bubble";
import { getMessageById, type Message } from "@/lib/queries/messages";
import { isAudioMessage } from "@/lib/utils/audio";

interface ChatWindowProps {
  messages: Message[];
  currentUserId: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onPinMessage?: (messageId: string, isPinned: boolean) => void;
  onDeleteMessage?: (messageId: string) => void;
  onReply?: (message: Message) => void;
  onEditMessage?: (messageId: string, content: string) => void;
  onForward?: (message: Message) => void;
  /** Other member's last_read_at (1:1 only, already gated by preferences). */
  seenAt?: string | null;
  isGroup?: boolean;
}

/** One-line description of a message for the quoted-reply block. */
export function replySnippet(message: Message): string {
  if (message.is_deleted) return "Message deleted";
  if (
    isAudioMessage(null, message.media_url) ||
    message.content?.startsWith("[audio]")
  ) {
    return "Voice message";
  }
  if (message.content) return message.content.slice(0, 80);
  if (message.media_url) return "Media";
  return "Message";
}

function formatDateDivider(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const messageDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  if (messageDate.getTime() === today.getTime()) return "Today";
  if (messageDate.getTime() === yesterday.getTime()) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function isSameDay(a: string, b: string): boolean {
  const dateA = new Date(a);
  const dateB = new Date(b);
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

export function ChatWindow({
  messages,
  currentUserId,
  onLoadMore,
  hasMore,
  isLoadingMore,
  onPinMessage,
  onDeleteMessage,
  onReply,
  onEditMessage,
  onForward,
  seenAt,
  isGroup,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Quoted replies resolve against already-loaded messages; anything older
  // than the loaded pages gets a one-shot fetch, cached here (null = gone).
  const [fetchedReplies, setFetchedReplies] = useState<
    Map<string, Message | null>
  >(new Map());

  useEffect(() => {
    const loaded = new Set(messages.map((m) => m.id));
    const missing = Array.from(
      new Set(
        messages
          .map((m) => m.reply_to_id)
          .filter(
            (id): id is string =>
              !!id && !loaded.has(id) && !fetchedReplies.has(id)
          )
      )
    );
    if (missing.length === 0) return;

    let cancelled = false;
    Promise.all(
      missing.map(
        async (id) =>
          [id, await getMessageById(id).catch(() => null)] as const
      )
    ).then((entries) => {
      if (cancelled) return;
      setFetchedReplies((prev) => new Map([...prev, ...entries]));
    });
    return () => {
      cancelled = true;
    };
  }, [messages, fetchedReplies]);

  const messageById = new Map(messages.map((m) => [m.id, m]));
  const resolveReply = (message: Message): QuotedReply | null => {
    if (!message.reply_to_id) return null;
    const source =
      messageById.get(message.reply_to_id) ??
      fetchedReplies.get(message.reply_to_id);
    if (!source) return null;
    return {
      name: source.sender?.display_name || "Message",
      snippet: replySnippet(source),
    };
  };

  // "Seen" sits under the newest own message the other member has read.
  let seenMessageId: string | null = null;
  if (seenAt && !isGroup) {
    const seenTime = new Date(seenAt).getTime();
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.sender_id !== currentUserId || m.id.startsWith("temp-")) continue;
      if (new Date(m.created_at).getTime() <= seenTime) seenMessageId = m.id;
      break;
    }
  }

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView();
    }
  }, [messages.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll-to-top to load more
  const handleScroll = () => {
    if (!containerRef.current || !hasMore || isLoadingMore) return;
    if (containerRef.current.scrollTop < 100) {
      onLoadMore?.();
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-3"
    >
      {isLoadingMore && (
        <div className="flex justify-center py-3">
          <svg
            className="size-5 animate-spin text-muted-foreground"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {messages.map((message, index) => {
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const showDateDivider =
            !prevMessage ||
            !isSameDay(prevMessage.created_at, message.created_at);
          const showSender =
            !prevMessage || prevMessage.sender_id !== message.sender_id;
          const isOwn = message.sender_id === currentUserId;

          return (
            <div key={message.id}>
              {showDateDivider && (
                <div className="flex items-center justify-center my-4">
                  <div className="bg-muted/60 text-muted-foreground text-xs px-3 py-1 rounded-full">
                    {formatDateDivider(message.created_at)}
                  </div>
                </div>
              )}
              <MessageBubble
                message={message}
                isOwn={isOwn}
                showSender={showSender}
                currentUserId={currentUserId}
                onPinMessage={onPinMessage}
                onDeleteMessage={onDeleteMessage}
                onReply={onReply}
                onEditMessage={onEditMessage}
                onForward={onForward}
                replyPreview={resolveReply(message)}
              />
              {message.id === seenMessageId && (
                <p className="m-0 mt-0.5 flex justify-end pr-1 text-[10px] font-medium text-muted-foreground/70">
                  Seen
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
