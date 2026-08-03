"use client";

import { useState, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VoiceRecorder } from "@/components/messages/voice-recorder";
import { cn } from "@/lib/utils";
import { generateSmartReplies } from "@/lib/services/smart-replies";

// Mirrors the post composer's image cap; video is tighter here because DM
// media skips the transcoding pass posts get.
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

export interface PendingAttachment {
  file: File;
  /** Local object URL for previews and the optimistic bubble. The page owns
   * revoking it once the upload lands or the send is abandoned. */
  previewUrl: string;
  kind: "image" | "video";
}

export interface ReplyPreview {
  name: string;
  snippet: string;
}

export interface MessageInputHandle {
  /** Puts text (and any unsent attachments) back, e.g. after an undone or
   * failed send. */
  restoreDraft: (text: string, attachments?: PendingAttachment[]) => void;
}

interface MessageInputProps {
  onSend: (content: string, attachments: PendingAttachment[]) => Promise<void>;
  onSendAudio?: (audioUrl: string) => Promise<void>;
  disabled?: boolean;
  /** The last message from the other person, used for smart reply suggestions. */
  lastReceivedMessage?: string;
  /** Message being replied to; renders the quoted bar above the input. */
  replyTo?: ReplyPreview | null;
  onCancelReply?: () => void;
  /** Reports input activity so the page can broadcast typing state. */
  onTypingActivity?: (hasText: boolean) => void;
  ref?: React.Ref<MessageInputHandle>;
}

export function MessageInput({
  onSend,
  onSendAudio,
  disabled,
  lastReceivedMessage,
  replyTo,
  onCancelReply,
  onTypingActivity,
  ref,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    restoreDraft: (text: string, restored?: PendingAttachment[]) => {
      setContent(text);
      if (restored && restored.length > 0) {
        setAttachments((prev) => [...restored, ...prev]);
      }
      setDismissed(true);
    },
  }));

  const handleSendAudio = useCallback(
    async (audioUrl: string) => {
      if (onSendAudio) {
        await onSendAudio(audioUrl);
      } else {
        await onSend(`[audio] ${audioUrl}`, []);
      }
    },
    [onSend, onSendAudio]
  );

  const smartReplies = useMemo(() => {
    if (!lastReceivedMessage) return [];
    return generateSmartReplies(lastReceivedMessage);
  }, [lastReceivedMessage]);

  const showSuggestions =
    smartReplies.length > 0 &&
    content.length === 0 &&
    attachments.length === 0 &&
    !dismissed &&
    !sending;

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const accepted: PendingAttachment[] = [];
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) continue;
      if (file.size > (isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE)) {
        toast.error(
          isVideo ? "Video must be under 50MB" : "Image must be under 10MB"
        );
        continue;
      }
      accepted.push({
        file,
        previewUrl: URL.createObjectURL(file),
        kind: isVideo ? "video" : "image",
      });
    }
    if (accepted.length > 0) {
      setAttachments((prev) => [...prev, ...accepted]);
      setDismissed(true);
    }
  };

  const removeAttachment = (previewUrl: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.previewUrl === previewUrl);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((a) => a.previewUrl !== previewUrl);
    });
  };

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if ((!trimmed && attachments.length === 0) || sending) return;

    setSending(true);
    onTypingActivity?.(false);
    try {
      await onSend(trimmed, attachments);
      setContent("");
      setAttachments([]);
      setDismissed(false);
    } catch {
      // The page surfaces the failure; keep the draft so the user can retry.
    } finally {
      setSending(false);
    }
  }, [content, attachments, sending, onSend, onTypingActivity]);

  const handleSuggestionClick = useCallback(
    async (suggestion: string) => {
      if (sending) return;
      setSending(true);
      try {
        await onSend(suggestion, []);
        setDismissed(false);
      } catch {
        // The page surfaces the failure.
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
    onTypingActivity?.(e.target.value.trim().length > 0);
    if (e.target.value.length > 0) {
      setDismissed(true);
    }
  };

  const canSend = (content.trim().length > 0 || attachments.length > 0) && !sending;

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur-sm p-3">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="min-w-0 flex-1 border-l-2 border-primary/60 pl-2.5">
            <p className="m-0 text-xs font-medium text-primary">
              Replying to {replyTo.name}
            </p>
            <p className="m-0 truncate text-xs text-muted-foreground">
              {replyTo.snippet}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Attachment preview strip */}
      {attachments.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {attachments.map((att) => (
            <div
              key={att.previewUrl}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30"
            >
              {att.kind === "video" ? (
                <video
                  src={att.previewUrl}
                  muted
                  className="h-full w-full object-cover"
                />
              ) : (
                // Object URLs bypass next/image on purpose: no remote loader.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={att.previewUrl}
                  alt="Attachment preview"
                  className="h-full w-full object-cover"
                />
              )}
              <button
                onClick={() => removeAttachment(att.previewUrl)}
                aria-label="Remove attachment"
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground transition-colors hover:bg-background"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFilesSelected(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach media"
              disabled={disabled || sending}
              className={cn(
                "h-10 w-10 shrink-0 flex items-center justify-center rounded-xl transition-colors",
                "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="Attach photo or video"
            >
              <Paperclip className="size-5" />
            </button>

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
              disabled={!canSend || disabled}
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
