"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { VoiceRecorder } from "@/components/messages/voice-recorder";
import { cn } from "@/lib/utils";
import { generateSmartReplies } from "@/lib/services/smart-replies";

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  onSendAudio?: (audioUrl: string) => Promise<void>;
  disabled?: boolean;
  /** The last message from the other person, used for smart reply suggestions. */
  lastReceivedMessage?: string;
}

export function MessageInput({ onSend, onSendAudio, disabled, lastReceivedMessage }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isRecordingMode, setIsRecordingMode] = useState(false);

  const handleSendAudio = useCallback(
    async (audioUrl: string) => {
      if (onSendAudio) {
        await onSendAudio(audioUrl);
      } else {
        await onSend(`[audio] ${audioUrl}`);
      }
    },
    [onSend, onSendAudio]
  );

  const smartReplies = useMemo(() => {
    if (!lastReceivedMessage) return [];
    return generateSmartReplies(lastReceivedMessage);
  }, [lastReceivedMessage]);

  const showSuggestions =
    smartReplies.length > 0 && content.length === 0 && !dismissed && !sending;

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setContent("");
      setDismissed(false);
    } finally {
      setSending(false);
    }
  }, [content, sending, onSend]);

  const handleSuggestionClick = useCallback(
    async (suggestion: string) => {
      if (sending) return;
      setSending(true);
      try {
        await onSend(suggestion);
        setDismissed(false);
      } finally {
        setSending(false);
      }
    },
    [sending, onSend]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (e.target.value.length > 0) {
      setDismissed(true);
    }
  };

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur-sm p-3">
      {/* Smart reply suggestions */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap gap-1.5 pb-2"
          >
            {smartReplies.map((reply, i) => (
              <motion.button
                key={reply}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15, delay: i * 0.05 }}
                onClick={() => handleSuggestionClick(reply)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium",
                  "bg-muted/50 text-muted-foreground border border-border/50",
                  "hover:bg-muted hover:text-foreground hover:border-border",
                  "transition-colors active:scale-95"
                )}
              >
                {reply}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2">
        {isRecordingMode ? (
          <VoiceRecorder
            onSend={handleSendAudio}
            onRecordingChange={(recording) => {
              if (!recording) setIsRecordingMode(false);
            }}
            disabled={disabled}
          />
        ) : (
          <>
            <textarea
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={disabled || sending}
              rows={1}
              className={cn(
                "flex-1 resize-none rounded-xl border border-input bg-muted/30 px-4 py-2.5",
                "text-sm placeholder:text-muted-foreground",
                "focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "max-h-32 min-h-[40px]"
              )}
              style={{
                height: "auto",
                minHeight: "40px",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 128) + "px";
              }}
            />

            {/* Mic button */}
            <VoiceRecorder
              onSend={handleSendAudio}
              onRecordingChange={(recording) => {
                if (recording) setIsRecordingMode(true);
              }}
              disabled={disabled || sending}
            />

            <Button
              onClick={handleSend}
              disabled={!content.trim() || sending || disabled}
              size="icon"
              className="rounded-xl h-10 w-10 shrink-0"
            >
              {sending ? (
                <svg
                  className="size-4 animate-spin"
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
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-4"
                >
                  <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
