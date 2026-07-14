"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Users,
  Pin,
  PinOff,
  Ban,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/hooks/use-auth";
import { useMessages } from "@/lib/hooks/use-messages";
import {
  sendMessage,
  markConversationRead,
  getPinnedMessages,
  pinMessage,
  unpinMessage,
  type Message,
} from "@/lib/queries/messages";
import { blockUser } from "@/lib/queries/social";
import { createClient } from "@/lib/supabase/client";
import { ChatWindow } from "@/components/messages/chat-window";
import { MessageInput } from "@/components/messages/message-input";
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

  const webrtc = useWebRTC(conversationId, user?.id ?? "");

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
  }, [user, conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    getPinnedMessages(conversationId).then(setPinnedMessages).catch(() => {});
  }, [conversationId, messages.length]);

  useEffect(() => {
    if (!user || !conversationId) return;
    markConversationRead(conversationId, user.id);
  }, [user, conversationId, messages.length]);

  const handleSend = async (content: string) => {
    if (!user) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      media_url: null,
      media_type: null,
      reply_to_id: null,
      is_deleted: false,
      created_at: new Date().toISOString(),
      sender: {
        id: user.id,
        username: user.user_metadata?.username ?? "",
        display_name: user.user_metadata?.display_name ?? "",
        avatar_url: user.user_metadata?.avatar_url ?? null,
      },
    };
    queryClient.setQueryData(
      ["messages", conversationId],
      (old: { pages: { messages: unknown[]; nextCursor: string | null }[] } | undefined) => {
        if (!old) return old;
        const firstPage = old.pages[0];
        if (!firstPage) return old;
        return {
          ...old,
          pages: [
            { ...firstPage, messages: [optimistic, ...firstPage.messages] },
            ...old.pages.slice(1),
          ],
        };
      }
    );
    try {
      const real = await sendMessage(conversationId, user.id, content);
      queryClient.setQueryData(
        ["messages", conversationId],
        (old: { pages: { messages: { id: string }[]; nextCursor: string | null }[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              messages: p.messages.map((m) => (m.id === tempId ? real : m)),
            })),
          };
        }
      );
    } catch (e) {
      console.error("sendMessage failed", e);
      queryClient.setQueryData(
        ["messages", conversationId],
        (old: { pages: { messages: { id: string }[]; nextCursor: string | null }[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              messages: p.messages.filter((m) => m.id !== tempId),
            })),
          };
        }
      );
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
    const ok = window.confirm(`Block @${otherUser.username}? They won't be able to message you.`);
    if (!ok) return;
    setBlockSaving(true);
    try {
      await blockUser(user.id, otherUser.id);
      toast.success(`@${otherUser.username} blocked`);
      router.push("/messages");
    } catch (e) {
      console.error("block failed", e);
      toast.error("Couldn't block user");
    } finally {
      setBlockSaving(false);
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

  const callPeer = otherUser
    ? { id: otherUser.id, display_name: otherUser.display_name, avatar_url: otherUser.avatar_url }
    : groupMembers.length > 0
      ? {
          id: groupMembers[0].id,
          display_name: headerName,
          avatar_url: conversationInfo?.avatar_url ?? null,
        }
      : null;

  return (
    <div className="grid h-[calc(100vh-48px)] grid-cols-1 gap-[18px] text-foreground xl:grid-cols-[minmax(0,1fr)_280px]">
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
          isGroup={isGroup}
        />
      )}

        <MessageInput onSend={handleSend} />
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
              {!isGroup && otherUser && (
                <button
                  type="button"
                  onClick={handleBlock}
                  disabled={blockSaving}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] text-destructive transition-colors hover:bg-surface-elevated disabled:opacity-60"
                >
                  <Ban className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Block @{otherUser.username}
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
          localStream={webrtc.localStream}
          remoteStream={webrtc.remoteStream}
          onToggleMute={webrtc.toggleMute}
          onToggleVideo={webrtc.toggleVideo}
          onEndCall={webrtc.endCall}
        />
      )}
    </div>
  );
}
