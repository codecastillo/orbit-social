"use client";

import { useState } from "react";
import { Copy, Send, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getConversations,
  sendMessage,
  type ConversationWithPreview,
} from "@/lib/queries/messages";

interface ShareDialogProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ postId, open, onOpenChange }: ShareDialogProps) {
  const { user } = useAuth();
  const [showConversations, setShowConversations] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => getConversations(user!.id),
    enabled: !!user?.id && showConversations,
    staleTime: 1000 * 60 * 2,
  });

  const postUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/post/${postId}`
      : `/post/${postId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleSendToChat = async (conversation: ConversationWithPreview) => {
    if (!user) return;
    setSendingTo(conversation.id);
    try {
      await sendMessage(conversation.id, user.id, postUrl);
      setSentTo((prev) => new Set(prev).add(conversation.id));
      toast.success("Sent to chat");
    } catch {
      toast.error("Failed to send");
    } finally {
      setSendingTo(null);
    }
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setShowConversations(false);
      setSentTo(new Set());
      setCopied(false);
    }
    onOpenChange(val);
  };

  const getConversationName = (conv: ConversationWithPreview) => {
    if (conv.is_group && conv.name) return conv.name;
    return conv.other_member?.display_name ?? "Unknown";
  };

  const getConversationAvatar = (conv: ConversationWithPreview) => {
    if (conv.is_group) return conv.avatar_url;
    return conv.other_member?.avatar_url ?? null;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Share Post</DialogTitle>
        </DialogHeader>

        {!showConversations ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {copied ? "Copied!" : "Copy Link"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Copy the post link to clipboard
                </p>
              </div>
            </button>

            <button
              onClick={() => setShowConversations(true)}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                <Send className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">Send to Chat</p>
                <p className="text-xs text-muted-foreground">
                  Share in a conversation
                </p>
              </div>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : conversations && conversations.length > 0 ? (
              conversations.map((conv) => {
                const isSent = sentTo.has(conv.id);
                const isSending = sendingTo === conv.id;

                return (
                  <div
                    key={conv.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
                  >
                    <UserAvatar
                      src={getConversationAvatar(conv)}
                      fallback={getConversationName(conv)}
                      size="sm"
                    />
                    <span className="flex-1 text-sm font-medium truncate">
                      {getConversationName(conv)}
                    </span>
                    <Button
                      variant={isSent ? "ghost" : "outline"}
                      size="sm"
                      className="rounded-lg h-8 text-xs shrink-0"
                      disabled={isSending || isSent}
                      onClick={() => handleSendToChat(conv)}
                    >
                      {isSending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isSent ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        "Send"
                      )}
                    </Button>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                No conversations yet.
              </p>
            )}

            <button
              onClick={() => setShowConversations(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-2 text-center py-1"
            >
              Back
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
