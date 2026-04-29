"use client";

import { useState } from "react";
import { Copy, Send, Check, Loader2, Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import { createRepost } from "@/lib/queries/posts";
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
  const queryClient = useQueryClient();
  const [showConversations, setShowConversations] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [message, setMessage] = useState("");

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

  const handleRepost = async () => {
    if (!user) {
      toast.error("Sign in to repost");
      return;
    }
    if (reposted || reposting) return;
    setReposting(true);
    try {
      await createRepost(user.id, postId);
      setReposted(true);
      toast.success("Reposted to your feed");
      // Bust caches that show repost count / user_has_reposted state.
      queryClient.invalidateQueries({ queryKey: ["clips"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to repost";
      if (msg === "Already reposted") {
        setReposted(true);
        toast.message("You already reposted this");
      } else {
        toast.error("Failed to repost");
      }
    } finally {
      setReposting(false);
    }
  };

  const handleSendToChat = async (conversation: ConversationWithPreview) => {
    if (!user) return;
    setSendingTo(conversation.id);
    try {
      // Prefix the user's optional note so it lands as a single message
      // followed by the post URL — the receiver gets context plus link.
      const body = message.trim()
        ? `${message.trim()}\n${postUrl}`
        : postUrl;
      await sendMessage(conversation.id, user.id, body);
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
      setReposted(false);
      setMessage("");
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
              onClick={handleRepost}
              disabled={reposting || reposted}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors text-left disabled:opacity-60"
            >
              <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                {reposting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : reposted ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Repeat2 className="h-4 w-4 text-emerald-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {reposted ? "Reposted" : "Repost"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Share this with your followers
                </p>
              </div>
            </button>

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
          <div className="flex flex-col gap-3">
            {/* Optional message attached to the shared link */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message…"
              maxLength={500}
              rows={2}
              className="w-full resize-none rounded-xl bg-white/[0.04] border border-white/[0.06] focus:border-white/20 focus:outline-none px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70"
            />

            <div className="flex flex-col gap-1 max-h-[280px] overflow-y-auto">
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
            </div>

            <button
              onClick={() => setShowConversations(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
            >
              Back
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
