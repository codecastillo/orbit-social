"use client";

import { cn } from "@/lib/utils";
import type { Message } from "@/lib/queries/messages";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSender: boolean;
}

export function MessageBubble({
  message,
  isOwn,
  showSender,
}: MessageBubbleProps) {
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (message.is_deleted) {
    return (
      <div
        className={cn("flex w-full", isOwn ? "justify-end" : "justify-start")}
      >
        <div
          className={cn(
            "max-w-[75%] rounded-2xl px-4 py-2",
            isOwn
              ? "bg-primary/10 text-primary/50"
              : "bg-muted/50 text-muted-foreground/50"
          )}
        >
          <p className="text-sm italic">This message was deleted</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full",
        isOwn ? "justify-end" : "justify-start",
        showSender ? "mt-3" : "mt-0.5"
      )}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2",
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted/80 text-foreground rounded-bl-md"
        )}
      >
        {showSender && !isOwn && message.sender && (
          <p className="text-xs font-medium text-muted-foreground mb-1">
            {message.sender.display_name}
          </p>
        )}
        {message.media_url && (
          <img
            src={message.media_url}
            alt="Media"
            className="rounded-lg max-w-full mb-1"
          />
        )}
        {message.content && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}
        <p
          className={cn(
            "text-[10px] mt-1 text-right",
            isOwn
              ? "text-primary-foreground/60"
              : "text-muted-foreground/60"
          )}
        >
          {time}
        </p>
      </div>
    </div>
  );
}
