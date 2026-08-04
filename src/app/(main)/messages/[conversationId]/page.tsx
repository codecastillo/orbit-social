"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Users,
  Pin,
  PinOff,
  Ban,
  ArrowLeft,
  Images,
  Settings2,
  Archive,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/hooks/use-auth";
import { useMessages } from "@/lib/hooks/use-messages";
import {
  sendMessage,
  markConversationRead,
  getPinnedMessages,
  getDmSeenAt,
  closeConversation,
  pinMessage,
  unpinMessage,
  deleteMessage,
  editMessage,
  type Message,
} from "@/lib/queries/messages";
import {
  blockUser,
  unblockUser,
  BLOCK_INVALIDATION_KEYS,
} from "@/lib/queries/social";
import { useBlockedIds } from "@/lib/hooks/use-content-safety";
import { BLOCKED_DM_MESSAGE, isBlockedDmError } from "@/lib/utils/blocked-error";
import { createClient } from "@/lib/supabase/client";
import { ChatWindow, replySnippet } from "@/components/messages/chat-window";
import {
  MessageInput,
  type MessageInputHandle,
  type PendingAttachment,
} from "@/components/messages/message-input";
import { ForwardMessageDialog } from "@/components/messages/forward-message-dialog";
import { ConversationMediaDialog } from "@/components/messages/conversation-media-dialog";
import { useUndoableSend } from "@/lib/hooks/use-undoable-send";
import {
  TypingIndicator,
  useTypingChannel,
} from "@/components/messages/typing-indicator";
import { GroupSettingsDialog } from "@/components/messages/group-settings-dialog";
import { ConfirmDialog } from "@/components/orbit/confirm-dialog";
import { CallButton } from "@/components/messages/call-button";
import { CallOverlay } from "@/components/messages/call-overlay";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useWebRTC } from "@/lib/hooks/use-webrtc";
import { cn } from "@/lib/utils";

interface ChatPageProps {
  params: Promise<{ conversationId: string }>;
}

interface OtherUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface ConversationInfo {
  is_group: boolean;
  name: string | null;
  avatar_url: string | null;
  created_by: string;
}

/** Same path shape the voice recorder uses in the message-media bucket. */
async function uploadMessageMedia(userId: string, file: File): Promise<string> {
  const supabase = createClient();
  const ext =
    file.name.split(".").pop()?.toLowerCase() ||
    file.type.split("/")[1] ||
    "bin";
  const filePath = `${userId}/${Date.now()}_media.${ext}`;

  const { error } = await supabase.storage
    .from("message-media")
    .upload(filePath, file, { contentType: file.type });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("message-media").getPublicUrl(filePath);
  return publicUrl;
}

export default function ChatPage({ params }: ChatPageProps) {
  const { conversationId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const {
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useMessages(conversationId);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loadingOther, setLoadingOther] = useState(true);
  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null);
  const [groupMembers, setGroupMembers] = useState<OtherUser[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [pinSaving, setPinSaving] = useState(false);
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [closeSaving, setCloseSaving] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const messageInputRef = useRef<MessageInputHandle>(null);
  const { schedule: scheduleUndoableSend, flush: flushUndoableSends } =
    useUndoableSend();

  // Switching conversations re-renders this page in place, so commit any
  // pending sends from the previous thread rather than letting an Undo
  // restore their text into the wrong input.
  useEffect(() => {
    return () => flushUndoableSends();
  }, [conversationId, flushUndoableSends]);

  // Only the viewer's own blocks are readable. If the other side blocked
  // them the composer stays put and the send surfaces the server's refusal.
  const { data: blockedIds } = useBlockedIds();
  const blockedCounterpart = !!otherUser && (blockedIds?.has(otherUser.id) ?? false);

  const webrtc = useWebRTC(conversationId, user?.id ?? "");

  const selfName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.username ||
    "Someone";
  const { typingNames, notifyTyping } = useTypingChannel(
    conversationId,
    user?.id ?? "",
    selfName
  );

  // Bumped by the group settings dialog after a mutation to refetch the
  // conversation info and member list.
  const [convVersion, setConvVersion] = useState(0);

  useEffect(() => {
    if (!user || !conversationId) return;
    (async () => {
      const supabase = createClient();
      const { data: conv } = await supabase
        .from("conversations")
        .select("is_group, name, avatar_url, created_by")
        .eq("id", conversationId)
        .single();

      const { data: membership } = await supabase
        .from("conversation_members")
        .select("is_pinned")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (membership) setIsPinned(membership.is_pinned ?? false);

      if (conv) {
        setConversationInfo(conv);

        if (conv.is_group) {
          const { data: members } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", conversationId);
          if (members) {
            const ids = members.map((m) => m.user_id).filter((id) => id !== user.id);
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .in("id", ids);
            setGroupMembers((profiles as OtherUser[]) ?? []);
          }
        } else {
          const { data: members } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", conversationId)
            .neq("user_id", user.id)
            .limit(1);
          if (members?.[0]) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .eq("id", members[0].user_id)
              .single();
            setOtherUser(profile);
          }
        }
      }
      setLoadingOther(false);
    })();
  }, [user, conversationId, convVersion]);

  useEffect(() => {
    if (!conversationId) return;
    getPinnedMessages(conversationId).then(setPinnedMessages).catch(() => {});
  }, [conversationId, messages.length]);

  useEffect(() => {
    if (!user || !conversationId) return;
    markConversationRead(conversationId, user.id);
  }, [user, conversationId, messages.length]);

  // Route param changes re-render this page in place, so a half-set reply
  // or a stale read state must not leak into another conversation. Adjusting
  // state during render (not in an effect) is the React-endorsed pattern.
  const [prevConversationId, setPrevConversationId] = useState(conversationId);
  if (prevConversationId !== conversationId) {
    setPrevConversationId(conversationId);
    setReplyTo(null);
    setForwardMessage(null);
    setMediaDialogOpen(false);
    setSeenAt(null);
  }

  // Read state for the "Seen" marker: refresh when messages change and when
  // the other member's last_read_at updates. getDmSeenAt already applies the
  // reciprocity gate, so a null here simply hides the marker.
  const isGroupConversation = conversationInfo?.is_group ?? false;
  useEffect(() => {
    if (!user || !conversationId || isGroupConversation) return;
    let cancelled = false;
    getDmSeenAt(conversationId, user.id)
      .then((value) => {
        if (!cancelled) setSeenAt(value);
      })
      .catch(() => {
        if (!cancelled) setSeenAt(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, conversationId, isGroupConversation, messages.length]);

  useEffect(() => {
    if (!user || !conversationId || isGroupConversation) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`read-state-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_members",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          getDmSeenAt(conversationId, user.id)
            .then(setSeenAt)
            .catch(() => {});
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, conversationId, isGroupConversation]);

  const handleSend = async (content: string, attachments: PendingAttachment[]) => {
    if (!user) return;
    if (!content && attachments.length === 0) return;
    const replyMessage = replyTo;
    const replyToId = replyMessage?.id;
    setReplyTo(null);

    // One message per attachment (the first carries the text), matching
    // mainstream behavior; a plain text send stays a single message.
    const outgoing =
      attachments.length > 0
        ? attachments.map((attachment, i) => ({
            tempId: `temp-${crypto.randomUUID()}`,
            content: i === 0 ? content : "",
            attachment: attachment as PendingAttachment | null,
          }))
        : [
            {
              tempId: `temp-${crypto.randomUUID()}`,
              content,
              attachment: null as PendingAttachment | null,
            },
          ];

    const sender = {
      id: user.id,
      username: user.user_metadata?.username ?? "",
      display_name: user.user_metadata?.display_name ?? "",
      avatar_url: user.user_metadata?.avatar_url ?? null,
    };
    const optimistic = outgoing.map((o, i) => ({
      id: o.tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content: o.content,
      // The local object URL renders in the bubble until the real upload
      // replaces it at commit time.
      media_url: o.attachment?.previewUrl ?? null,
      media_type: o.attachment?.kind ?? null,
      reply_to_id: i === 0 ? (replyToId ?? null) : null,
      is_deleted: false,
      is_pinned: false,
      created_at: new Date().toISOString(),
      sender,
    }));
    queryClient.setQueryData(
      ["messages", conversationId],
      (old: { pages: { messages: unknown[]; nextCursor: string | null }[] } | undefined) => {
        if (!old) return old;
        const firstPage = old.pages[0];
        if (!firstPage) return old;
        // Pages hold newest-first, so reverse to keep the send order on screen.
        return {
          ...old,
          pages: [
            {
              ...firstPage,
              messages: [
                ...[...optimistic].reverse(),
                ...firstPage.messages,
              ],
            },
            ...old.pages.slice(1),
          ],
        };
      }
    );
    const removeOptimistic = (tempIds: string[]) =>
      queryClient.setQueryData(
        ["messages", conversationId],
        (old: { pages: { messages: { id: string }[]; nextCursor: string | null }[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              messages: p.messages.filter((m) => !tempIds.includes(m.id)),
            })),
          };
        }
      );

    // Uploads happen here, after the undo window, so an Undo costs nothing.
    const commit = async () => {
      for (let i = 0; i < outgoing.length; i++) {
        const o = outgoing[i];
        try {
          let mediaUrl: string | undefined;
          if (o.attachment) {
            mediaUrl = await uploadMessageMedia(user.id, o.attachment.file);
          }
          const real = await sendMessage(
            conversationId,
            user.id,
            o.content,
            mediaUrl,
            o.attachment?.kind,
            i === 0 ? replyToId : undefined
          );
          queryClient.setQueryData(
            ["messages", conversationId],
            (old: { pages: { messages: { id: string }[]; nextCursor: string | null }[] } | undefined) => {
              if (!old) return old;
              return {
                ...old,
                pages: old.pages.map((p) => ({
                  ...p,
                  messages: p.messages.map((m) =>
                    m.id === o.tempId ? real : m
                  ),
                })),
              };
            }
          );
          if (o.attachment) URL.revokeObjectURL(o.attachment.previewUrl);
        } catch (e) {
          console.error("sendMessage failed", e);
          // Drop this bubble and everything after it; hand the unsent part
          // of the draft back for a retry instead of rethrowing.
          const remaining = outgoing.slice(i);
          removeOptimistic(remaining.map((r) => r.tempId));
          if (i === 0) setReplyTo(replyMessage);
          messageInputRef.current?.restoreDraft(
            i === 0 ? content : "",
            remaining
              .map((r) => r.attachment)
              .filter((a): a is PendingAttachment => a !== null)
          );
          // The commit runs after the undo window, by which point the user
          // may have left the thread, so the toast is the only surface left.
          toast.error(
            isBlockedDmError(e) ? BLOCKED_DM_MESSAGE : "Couldn't send message"
          );
          return;
        }
      }
    };

    // The write commits after the undo window; the optimistic bubbles are
    // already on screen, so the thread reads as sent immediately.
    scheduleUndoableSend({
      message: "Sent",
      commit: () => void commit(),
      onUndo: () => {
        removeOptimistic(outgoing.map((o) => o.tempId));
        setReplyTo(replyMessage);
        messageInputRef.current?.restoreDraft(content, attachments);
      },
    });
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    type Cached = {
      pages: { messages: Message[]; nextCursor: string | null }[];
    };
    const cached = queryClient.getQueryData<Cached>([
      "messages",
      conversationId,
    ]);
    const previous = cached?.pages
      .flatMap((p) => p.messages)
      .find((m) => m.id === messageId);

    const apply = (patch: Partial<Message>) =>
      queryClient.setQueryData(
        ["messages", conversationId],
        (old: Cached | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              messages: p.messages.map((m) =>
                m.id === messageId ? { ...m, ...patch } : m
              ),
            })),
          };
        }
      );

    apply({ content, updated_at: new Date().toISOString() });
    try {
      await editMessage(messageId, content);
    } catch (e) {
      console.error("editMessage failed", e);
      apply({
        content: previous?.content ?? content,
        updated_at: previous?.updated_at ?? null,
      });
      toast.error("Couldn't edit message");
    }
  };

  const togglePin = async () => {
    if (!user || pinSaving) return;
    setPinSaving(true);
    const next = !isPinned;
    setIsPinned(next);
    const supabase = createClient();
    const { error } = await supabase
      .from("conversation_members")
      .update({ is_pinned: next })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
    setPinSaving(false);
    if (error) {
      console.error("pin conversation failed", error);
      setIsPinned(!next);
      toast.error("Couldn't update pin");
      return;
    }
    toast.success(next ? "Conversation pinned" : "Pin removed");
  };

  const handleBlock = async () => {
    if (!user || !otherUser || blockSaving) return;
    setBlockSaving(true);
    try {
      await blockUser(user.id, otherUser.id);
      // The block trigger severs the follows both ways, so the follow graph
      // caches behind the counts and lists are immediately wrong.
      for (const queryKey of BLOCK_INVALIDATION_KEYS) {
        queryClient.invalidateQueries({ queryKey });
      }
      toast.success(`@${otherUser.username} blocked`);
      router.push("/messages");
    } catch (e) {
      console.error("block failed", e);
      toast.error("Couldn't block user");
    } finally {
      setBlockSaving(false);
    }
  };

  const handleUnblock = async () => {
    if (!user || !otherUser) return;
    try {
      await unblockUser(user.id, otherUser.id);
      queryClient.invalidateQueries({ queryKey: ["blocked-ids", user.id] });
      toast.success(`@${otherUser.username} unblocked`);
    } catch (e) {
      console.error("unblock failed", e);
      toast.error("Couldn't unblock user");
    }
  };

  const handleClose = async () => {
    if (!user || closeSaving) return;
    setCloseSaving(true);
    try {
      await closeConversation(conversationId, user.id);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Conversation closed");
      router.push("/messages");
    } catch (e) {
      console.error("closeConversation failed", e);
      toast.error("Couldn't close conversation");
    } finally {
      setCloseSaving(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const setDeleted = (deleted: boolean) =>
      queryClient.setQueryData(
        ["messages", conversationId],
        (old: { pages: { messages: Message[]; nextCursor: string | null }[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              messages: p.messages.map((m) =>
                m.id === messageId ? { ...m, is_deleted: deleted } : m
              ),
            })),
          };
        }
      );
    setDeleted(true);
    try {
      await deleteMessage(messageId);
    } catch (e) {
      console.error("deleteMessage failed", e);
      setDeleted(false);
      toast.error("Couldn't delete message");
    }
  };

  const handlePinMessage = async (messageId: string, isPinned: boolean) => {
    try {
      if (isPinned) await unpinMessage(messageId);
      else await pinMessage(messageId);
      const updated = await getPinnedMessages(conversationId);
      setPinnedMessages(updated);
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    } catch {}
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex-1" />
      </div>
    );
  }

  if (!user) return null;

  const isGroup = conversationInfo?.is_group ?? false;
  const headerName = isGroup
    ? conversationInfo?.name || "Group Chat"
    : otherUser?.display_name || "Conversation";
  const headerSubtext = isGroup
    ? `${groupMembers.length + 1} members`
    : otherUser
      ? `@${otherUser.username}`
      : "";

  // Calls are DM-only: never derive a call peer for group conversations.
  const callPeer =
    !isGroup && otherUser
      ? { id: otherUser.id, display_name: otherUser.display_name, avatar_url: otherUser.avatar_url }
      : null;

  return (
    // dvh, not vh: iOS Safari's 100vh is the large viewport, which shoved the
    // input under the URL bar. Mobile also subtracts the fixed bottom nav.
    <div className="grid h-[calc(100dvh-112px-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-48px)] grid-cols-1 gap-[18px] text-foreground xl:grid-cols-[minmax(0,1fr)_280px]">
      {/* CHAT PANEL */}
      <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface">
        {/* Header */}
        <div className="border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push("/messages")}
            aria-label="Back to messages"
            className="h-10 w-10 rounded-lg bg-surface-elevated hover:bg-muted border border-border flex items-center justify-center text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {loadingOther ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {isGroup ? (
                conversationInfo?.avatar_url ? (
                  <UserAvatar
                    src={conversationInfo.avatar_url}
                    fallback={headerName}
                    size="sm"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 border border-border flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                )
              ) : otherUser ? (
                <UserAvatar
                  src={otherUser.avatar_url}
                  fallback={otherUser.display_name}
                  size="sm"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight truncate text-foreground">
                  {headerName}
                </p>
                {headerSubtext && (
                  <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                    {headerSubtext}
                  </p>
                )}
              </div>
            </div>
          )}

          {!loadingOther && (
            <button
              onClick={() => setMediaDialogOpen(true)}
              aria-label="Conversation media"
              className="h-10 w-10 rounded-lg bg-surface-elevated hover:bg-muted border border-border flex items-center justify-center text-muted-foreground transition-colors shrink-0"
              title="Media"
            >
              <Images className="h-4 w-4" />
            </button>
          )}

          {isGroup && !loadingOther && (
            <button
              onClick={() => setGroupSettingsOpen(true)}
              aria-label="Group settings"
              className="h-10 w-10 rounded-lg bg-surface-elevated hover:bg-muted border border-border flex items-center justify-center text-muted-foreground transition-colors shrink-0"
              title="Group settings"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          )}

          {!isGroup && (
            <button
              onClick={togglePin}
              disabled={pinSaving}
              aria-label={isPinned ? "Unpin conversation" : "Pin conversation"}
              className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center transition-colors shrink-0 border",
                isPinned
                  ? "text-primary bg-primary/10 border-primary/20 hover:bg-primary/20"
                  : "text-muted-foreground bg-surface-elevated border-border hover:bg-muted"
              )}
              title={isPinned ? "Unpin conversation" : "Pin conversation"}
            >
              {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
          )}

          {!loadingOther && callPeer && (
            <CallButton
              onVoiceCall={() => webrtc.startCall(false)}
              onVideoCall={() => webrtc.startCall(true)}
            />
          )}
        </div>

      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-border border-t-primary animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground/80">No messages yet</p>
            <p className="text-xs mt-1 text-muted-foreground/70">
              Send the first message below.
            </p>
          </div>
        </div>
      ) : (
        <ChatWindow
          messages={messages}
          currentUserId={user.id}
          onLoadMore={() => fetchNextPage()}
          hasMore={!!hasNextPage}
          isLoadingMore={isFetchingNextPage}
          onPinMessage={handlePinMessage}
          onDeleteMessage={handleDeleteMessage}
          onReply={setReplyTo}
          onEditMessage={handleEditMessage}
          onForward={setForwardMessage}
          seenAt={seenAt}
          isGroup={isGroup}
        />
      )}

        <TypingIndicator names={typingNames} isGroup={isGroup} />
        {blockedCounterpart ? (
          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border bg-surface px-5 py-4 text-center">
            <p className="m-0 text-[13px] text-text-secondary">
              You blocked @{otherUser?.username}. Unblock them to send messages.
            </p>
            <Button variant="outline" size="sm" onClick={handleUnblock}>
              Unblock
            </Button>
          </div>
        ) : (
          <MessageInput
            ref={messageInputRef}
            onSend={handleSend}
            onTypingActivity={notifyTyping}
            replyTo={
              replyTo
                ? {
                    name:
                      replyTo.sender_id === user.id
                        ? "yourself"
                        : replyTo.sender?.display_name || "Message",
                    snippet: replySnippet(replyTo),
                  }
                : null
            }
            onCancelReply={() => setReplyTo(null)}
          />
        )}
      </div>{/* /chat panel */}

      {/* PROFILE RAIL */}
      {!loadingOther && (otherUser || isGroup) && (
        <aside className="hidden xl:block sticky top-6 h-fit max-h-[calc(100vh-48px)] overflow-auto rounded-xl border border-border bg-surface p-[22px]">
          <div className="border-b border-border pb-5 text-center">
            {isGroup ? (
              <div className="mx-auto flex h-[76px] w-[76px] items-center justify-center rounded-full bg-primary text-[28px] font-bold text-primary-foreground">
                {headerName[0]?.toUpperCase()}
              </div>
            ) : otherUser ? (
              <div className="inline-block">
                <UserAvatar
                  src={otherUser.avatar_url}
                  fallback={otherUser.display_name}
                  size="xl"
                />
              </div>
            ) : null}
            <div className="mt-2.5 text-base font-semibold">
              {headerName}
            </div>
            <div className="font-mono text-[11px] tracking-[0.06em] text-muted-foreground">
              {isGroup
                ? `${groupMembers.length + 1} MEMBERS`
                : `@${otherUser?.username.toUpperCase()}`}
            </div>
            {!isGroup && otherUser && (
              <Link href={`/${otherUser.username}`} className="no-underline">
                <Button variant="outline" size="sm" className="mt-3">
                  View profile →
                </Button>
              </Link>
            )}
          </div>

          {pinnedMessages.length > 0 && (
            <div className="mt-[18px]">
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
                ◇&nbsp;&nbsp;PINNED · {pinnedMessages.length}
              </p>
              <div className="mt-2.5 flex flex-col gap-1.5">
                {pinnedMessages.slice(0, 3).map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs leading-normal text-text-secondary"
                  >
                    {(m.content || "Media").slice(0, 60)}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-[18px]">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              ◈&nbsp;&nbsp;ACTIONS
            </p>
            <div className="mt-2.5">
              {isGroup && (
                <button
                  type="button"
                  onClick={() => setGroupSettingsOpen(true)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] text-text-secondary transition-colors hover:bg-surface-elevated"
                >
                  <Settings2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Group settings
                </button>
              )}
              {!isGroup && (
                <button
                  type="button"
                  onClick={togglePin}
                  disabled={pinSaving}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-surface-elevated disabled:opacity-60",
                    isPinned ? "text-primary" : "text-text-secondary"
                  )}
                >
                  {isPinned ? (
                    <PinOff className="h-3.5 w-3.5" strokeWidth={1.8} />
                  ) : (
                    <Pin className="h-3.5 w-3.5" strokeWidth={1.8} />
                  )}
                  {isPinned ? "Unpin conversation" : "Pin conversation"}
                </button>
              )}
              {/* Not destructive: nothing is deleted, the thread just leaves
                  the list until a new message resurfaces it, so no danger
                  styling. */}
              <button
                type="button"
                onClick={() => setCloseConfirmOpen(true)}
                disabled={closeSaving}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] text-text-secondary transition-colors hover:bg-surface-elevated disabled:opacity-60"
              >
                <Archive className="h-3.5 w-3.5" strokeWidth={1.8} />
                Close conversation
              </button>
              {!isGroup && otherUser && (
                <button
                  type="button"
                  onClick={() =>
                    blockedCounterpart
                      ? void handleUnblock()
                      : setBlockConfirmOpen(true)
                  }
                  disabled={blockSaving}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-surface-elevated disabled:opacity-60",
                    blockedCounterpart ? "text-text-secondary" : "text-destructive"
                  )}
                >
                  <Ban className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {blockedCounterpart ? "Unblock" : "Block"} @{otherUser.username}
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {webrtc.callState !== "idle" && callPeer && (
        <CallOverlay
          callState={webrtc.callState}
          peerName={callPeer.display_name}
          peerAvatarUrl={callPeer.avatar_url}
          isVideo={webrtc.isVideo}
          isMuted={webrtc.isMuted}
          isCameraOff={webrtc.isCameraOff}
          localStream={webrtc.localStream}
          remoteStream={webrtc.remoteStream}
          onToggleMute={webrtc.toggleMute}
          onToggleVideo={webrtc.toggleVideo}
          onAcceptCall={webrtc.acceptCall}
          onDeclineCall={webrtc.declineCall}
          onEndCall={webrtc.endCall}
        />
      )}

      {isGroup && (
        <GroupSettingsDialog
          open={groupSettingsOpen}
          onOpenChange={setGroupSettingsOpen}
          conversationId={conversationId}
          groupName={conversationInfo?.name ?? ""}
          members={groupMembers}
          currentUserId={user.id}
          onChanged={() => setConvVersion((v) => v + 1)}
        />
      )}

      <ForwardMessageDialog
        open={!!forwardMessage}
        onOpenChange={(val) => {
          if (!val) setForwardMessage(null);
        }}
        message={forwardMessage}
      />

      <ConversationMediaDialog
        open={mediaDialogOpen}
        onOpenChange={setMediaDialogOpen}
        conversationId={conversationId}
      />

      <ConfirmDialog
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        title="Close conversation?"
        description="It disappears from your messages until someone sends a new message."
        confirmLabel="Close"
        onConfirm={handleClose}
      />

      {otherUser && (
        <ConfirmDialog
          open={blockConfirmOpen}
          onOpenChange={setBlockConfirmOpen}
          title={`Block @${otherUser.username}?`}
          description="They won't be able to message you."
          confirmLabel="Block"
          danger
          onConfirm={handleBlock}
        />
      )}
    </div>
  );
}
