"use client";

import { useState, useEffect } from "react";
import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAudioMessage } from "@/lib/utils/audio";
import { InlineAudioPlayer } from "@/components/shared/inline-audio-player";
import {
  MessageReactionPicker,
  MessageReactionsDisplay,
} from "@/components/messages/message-reaction-picker";
import {
  addMessageReaction,
  removeMessageReaction,
  getMessageReactions,
  type Message,
} from "@/lib/queries/messages";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSender: boolean;
  currentUserId?: string;
  onPinMessage?: (messageId: string, isPinned: boolean) => void;
}

export function MessageBubble({
  message,
  isOwn,
  showSender,
  currentUserId,
  onPinMessage,
}: MessageBubbleProps) {
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const [reactions, setReactions] = useState<
    { emoji: string; count: number; hasReacted: boolean }[]
  >([]);

  useEffect(() => {
    if (message.is_deleted) return;
    getMessageReactions(message.id)
      .then((data) =>
        setReactions(
          data.map((r) => ({
            emoji: r.emoji,
            count: r.count,
            hasReacted: currentUserId
              ? r.userIds.includes(currentUserId)
              : false,
          }))
        )
      )
      .catch(() => {});
  }, [message.id, message.is_deleted, currentUserId]);

  const handleReactionSelect = async (emoji: string) => {
    if (!currentUserId) return;
    const existing = reactions.find(
      (r) => r.emoji === emoji && r.hasReacted
    );

    if (existing) {
      // Remove reaction
      setReactions((prev) =>
        prev
          .map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.count - 1, hasReacted: false }
              : r
          )
          .filter((r) => r.count > 0)
      );
      try {
        await removeMessageReaction(message.id, currentUserId, emoji);
      } catch {
        getMessageReactions(message.id).then((data) =>
          setReactions(
            data.map((r) => ({
              emoji: r.emoji,
              count: r.count,
              hasReacted: r.userIds.includes(currentUserId),
            }))
          )
        );
      }
    } else {
      // Add reaction
      setReactions((prev) => {
        const found = prev.find((r) => r.emoji === emoji);
        if (found) {
          return prev.map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.count + 1, hasReacted: true }
              : r
          );
        }
        return [...prev, { emoji, count: 1, hasReacted: true }];
      });
      try {
        await addMessageReaction(message.id, currentUserId, emoji);
      } catch {
        getMessageReactions(message.id).then((data) =>
          setReactions(
            data.map((r) => ({
              emoji: r.emoji,
              count: r.count,
              hasReacted: r.userIds.includes(currentUserId),
            }))
          )
        );
      }
    }
  };

  const handleReactionToggle = (emoji: string) => {
    handleReactionSelect(emoji);
  };

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
          className={cn("max-w-[75%] py-1.5 px-1.5")}
          style={{
            borderRadius: isOwn ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
            background: isOwn
              ? "linear-gradient(135deg, #8b73ff 0%, #ff5fae 55%, #5fd4ff 100%)"
              : "rgba(255,255,255,0.08)",
            border: isOwn ? "none" : "1px solid rgba(255,255,255,0.09)",
            color: isOwn ? "white" : "rgba(255,255,255,0.92)",
            boxShadow: isOwn ? "0 6px 18px rgba(255,95,174,0.25)" : "none",
          }}
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
        "flex w-full group",
        isOwn ? "justify-end" : "justify-start",
        showSender ? "mt-3" : "mt-0.5"
      )}
    >
      <div className="flex flex-col max-w-[75%]">
        <div className="flex items-center gap-1.5 min-w-0">
          {isOwn && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {onPinMessage && (
                <button
                  onClick={() => onPinMessage(message.id, !!message.is_pinned)}
                  className={cn(
                    "h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/[0.06] transition-colors",
                    message.is_pinned ? "text-amber-400" : "text-muted-foreground"
                  )}
                  title={message.is_pinned ? "Unpin message" : "Pin message"}
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
              )}
              <MessageReactionPicker
                onSelect={handleReactionSelect}
                existingEmojis={reactions
                  .filter((r) => r.hasReacted)
                  .map((r) => r.emoji)}
              />
            </div>
          )}
          <div className="relative min-w-0">
            {message.is_pinned && (
              <div className="absolute -top-3 right-2">
                <Pin className="h-3 w-3 text-amber-400" />
              </div>
            )}
            <div
              className={cn(
                "px-4 py-2 text-white",
                message.is_pinned && "ring-1 ring-amber-500/20"
              )}
              style={{
                borderRadius: isOwn ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
                background: isOwn
                  ? "linear-gradient(135deg, #8b73ff 0%, #ff5fae 55%, #5fd4ff 100%)"
                  : "rgba(255,255,255,0.08)",
                border: isOwn ? "none" : "1px solid rgba(255,255,255,0.09)",
                color: isOwn ? "white" : "rgba(255,255,255,0.92)",
                boxShadow: isOwn ? "0 6px 18px rgba(255,95,174,0.25)" : "none",
              }}
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
          {!isOwn && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <MessageReactionPicker
                onSelect={handleReactionSelect}
                existingEmojis={reactions
                  .filter((r) => r.hasReacted)
                  .map((r) => r.emoji)}
              />
              {onPinMessage && (
                <button
                  onClick={() => onPinMessage(message.id, !!message.is_pinned)}
                  className={cn(
                    "h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/[0.06] transition-colors",
                    message.is_pinned ? "text-amber-400" : "text-muted-foreground"
                  )}
                  title={message.is_pinned ? "Unpin message" : "Pin message"}
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
        {reactions.length > 0 && (
          <div className={cn("px-2", isOwn ? "self-end" : "self-start")}>
            <MessageReactionsDisplay
              reactions={reactions}
              onToggle={handleReactionToggle}
            />
          </div>
        )}
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
