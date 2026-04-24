"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import type { Message } from "@/lib/queries/messages";

interface ChatWindowProps {
  messages: Message[];
  currentUserId: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onPinMessage?: (messageId: string, isPinned: boolean) => void;
  isGroup?: boolean;
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
  isGroup,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

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
              />
            </div>
          );
        })}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
