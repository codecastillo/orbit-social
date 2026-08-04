"use client";

import { useCallback, useEffect, useState } from "react";
import { Forward, Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ModalShell, Field, Input } from "@/components/orbit/forms";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import { searchUsers, type ProfileSummary } from "@/lib/queries/social";
import {
  MESSAGE_NOT_ALLOWED_MESSAGE,
  isMessageNotAllowedError,
} from "@/lib/utils/blocked-error";
import {
  getConversations,
  getOrCreateDMConversation,
  sendMessage,
  type ConversationWithPreview,
  type Message,
} from "@/lib/queries/messages";

const RECENT_CONVERSATIONS_SHOWN = 8;

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The message being forwarded; content and media are copied verbatim. */
  message: Message | null;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  message,
}: ForwardMessageDialogProps) {
  const { user } = useAuth();
  const [recents, setRecents] = useState<ConversationWithPreview[]>([]);
  const [loadingRecents, setLoadingRecents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  // Show the loading row from the first frame of an open. Adjusted during
  // render per the React "adjusting state when a prop changes" pattern.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setLoadingRecents(true);
  }

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    getConversations(user.id)
      .then((all) => {
        if (!cancelled) setRecents(all.slice(0, RECENT_CONVERSATIONS_SHOWN));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingRecents(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (query.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const results = await searchUsers(query, 10);
        setSearchResults(results.filter((r) => r.id !== user?.id));
      } catch {
        toast.error("Couldn't search users");
      } finally {
        setSearching(false);
      }
    },
    [user?.id]
  );

  const reset = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  // Forwards commit immediately: no undo window, matching mainstream apps.
  const forwardTo = async (conversationId: string, label: string) => {
    if (!user || !message) return;
    await sendMessage(
      conversationId,
      user.id,
      message.content ?? "",
      message.media_url ?? undefined,
      (message.media_type as "image" | "video" | "gif" | null) ?? undefined
    );
    toast.success(`Forwarded to ${label}`);
    onOpenChange(false);
    reset();
  };

  const handleSelectConversation = async (conv: ConversationWithPreview) => {
    if (sendingTo) return;
    setSendingTo(conv.id);
    try {
      await forwardTo(conv.id, conversationLabel(conv));
    } catch (e) {
      console.error("forward failed", e);
      toast.error(
        isMessageNotAllowedError(e)
          ? MESSAGE_NOT_ALLOWED_MESSAGE
          : "Couldn't forward message"
      );
    } finally {
      setSendingTo(null);
    }
  };

  const handleSelectUser = async (profile: ProfileSummary) => {
    if (!user || sendingTo) return;
    setSendingTo(profile.id);
    try {
      const conversationId = await getOrCreateDMConversation(
        user.id,
        profile.id
      );
      await forwardTo(conversationId, profile.display_name);
    } catch (e) {
      console.error("forward failed", e);
      toast.error(
        isMessageNotAllowedError(e)
          ? MESSAGE_NOT_ALLOWED_MESSAGE
          : "Couldn't forward message"
      );
    } finally {
      setSendingTo(null);
    }
  };

  const conversationLabel = (conv: ConversationWithPreview) =>
    conv.is_group
      ? conv.name || "Group chat"
      : conv.other_member?.display_name || "Conversation";

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) reset();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 border-0 bg-transparent shadow-none max-w-none w-auto ring-0"
      >
        <DialogTitle className="sr-only">Forward message</DialogTitle>
        <ModalShell
          title="Forward message"
          subtitle="Send a copy to another conversation."
          icon={<Forward className="h-[17px] w-[17px]" strokeWidth={1.8} />}
          canSubmit={false}
          onClose={() => onOpenChange(false)}
          onSecondary={() => onOpenChange(false)}
          secondaryLabel="Close"
        >
          <Field label="To">
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or @handle…"
              prefix={
                <Search
                  className="h-3.5 w-3.5 text-muted-foreground"
                  strokeWidth={1.8}
                />
              }
              autoFocus
            />
          </Field>

          {searching && (
            <div className="mb-[18px] flex items-center gap-2.5 rounded-xl border border-border bg-surface-elevated px-4 py-3.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Searching…</span>
            </div>
          )}

          {searchQuery.trim().length < 2 && (
            <>
              <div className="mb-2.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-muted-foreground">
                RECENT
              </div>
              {loadingRecents && (
                <div className="flex items-center gap-2.5 px-2.5 py-3">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Loading conversations…
                  </span>
                </div>
              )}
              {!loadingRecents && recents.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No conversations yet
                </p>
              )}
              {recents.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  disabled={!!sendingTo}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2.5 text-left text-foreground disabled:opacity-50"
                >
                  {conv.is_group ? (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-primary/10">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                  ) : (
                    <UserAvatar
                      src={conv.other_member?.avatar_url ?? null}
                      fallback={conversationLabel(conv)}
                      size="md"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">
                      {conversationLabel(conv)}
                    </div>
                    {!conv.is_group && conv.other_member && (
                      <div className="text-[11.5px] text-muted-foreground">
                        @{conv.other_member.username}
                      </div>
                    )}
                  </div>
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[11.5px] font-medium text-foreground">
                    {sendingTo === conv.id ? "…" : "Send"}
                  </span>
                </button>
              ))}
            </>
          )}

          {searchResults.length > 0 && (
            <>
              <div className="mb-2.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-muted-foreground">
                RESULTS
              </div>
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectUser(p)}
                  disabled={!!sendingTo}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2.5 text-left text-foreground disabled:opacity-50"
                >
                  <UserAvatar
                    src={p.avatar_url}
                    fallback={p.display_name}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">
                      {p.display_name}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      @{p.username}
                    </div>
                  </div>
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[11.5px] font-medium text-foreground">
                    {sendingTo === p.id ? "…" : "Send"}
                  </span>
                </button>
              ))}
            </>
          )}

          {searchQuery.trim().length >= 2 &&
            !searching &&
            searchResults.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No users found
              </p>
            )}
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}
