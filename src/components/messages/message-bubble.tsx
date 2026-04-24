"use client";

import { cn } from "@/lib/utils";
import { isAudioMessage } from "@/lib/utils/audio";
import { InlineAudioPlayer } from "@/components/shared/inline-audio-player";
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

  // Determine if this is an audio message
  const audioSrc = getAudioSrc(message);
  const isAudio = !!audioSrc;

  if (isAudio) {
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
            "max-w-[75%] rounded-2xl py-1.5 px-1.5",
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted/80 text-foreground rounded-bl-md"
          )}
        >
          {showSender && !isOwn && message.sender && (
            <p className="text-xs font-medium text-muted-foreground mb-1 px-2.5 pt-1">
              {message.sender.display_name}
            </p>
          )}
          <div className="flex items-center gap-1.5 px-1">
            {/* Mic icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={cn("size-4 shrink-0", isOwn ? "text-primary-foreground/60" : "text-muted-foreground/60")}>
              <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
              <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
            </svg>
            <InlineAudioPlayer
              src={audioSrc}
              variant="message"
              isOwn={isOwn}
            />
          </div>
          <p
            className={cn(
              "text-[10px] mt-0.5 text-right px-2.5 pb-0.5",
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
        {message.media_url && !isAudioMessage(null, message.media_url) && (
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

/**
 * Extract audio source URL from a message if it's an audio message
 */
function getAudioSrc(message: Message): string | null {
  // Check media_url for audio file extensions
  if (message.media_url) {
    const lower = message.media_url.toLowerCase();
    if (
      lower.endsWith(".webm") ||
      lower.endsWith(".mp3") ||
      lower.endsWith(".ogg") ||
      lower.endsWith(".m4a") ||
      lower.endsWith(".wav")
    ) {
      return message.media_url;
    }
  }

  // Check content for [audio] marker
  if (message.content?.startsWith("[audio]")) {
    const url = message.content.replace("[audio]", "").trim();
    if (url) return url;
  }

  return null;
}
