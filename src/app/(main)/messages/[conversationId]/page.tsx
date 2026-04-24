"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Pin, ChevronDown, ChevronUp, ShieldCheck, Lock } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { ChatWindow } from "@/components/messages/chat-window";
import { MessageInput } from "@/components/messages/message-input";
import { CallButton } from "@/components/messages/call-button";
import { CallOverlay } from "@/components/messages/call-overlay";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWebRTC, type CallState } from "@/lib/hooks/use-webrtc";
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
  is_encrypted: boolean;
  name: string | null;
  avatar_url: string | null;
  created_by: string;
}

export default function ChatPage({ params }: ChatPageProps) {
  const { conversationId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const { messages, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useMessages(conversationId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loadingOther, setLoadingOther] = useState(true);
  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null);
  const [groupMembers, setGroupMembers] = useState<OtherUser[]>([]);

  // Encryption state
  const [isEncrypted, setIsEncrypted] = useState(false);

  // Pinned messages
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [pinnedExpanded, setPinnedExpanded] = useState(false);

  // WebRTC call
  const webrtc = useWebRTC(conversationId, user?.id ?? "");

  // Fetch conversation info and other user's profile
  useEffect(() => {
    if (!user || !conversationId) return;

    const fetchInfo = async () => {
      const supabase = createClient();

      // Get conversation details
      const { data: conv } = await supabase
        .from("conversations")
        .select("is_group, is_encrypted, name, avatar_url, created_by")
        .eq("id", conversationId)
        .single();

      if (conv) {
        setConversationInfo(conv);
        setIsEncrypted(conv.is_encrypted ?? false);

        if (conv.is_group) {
          // Fetch group members
          const { data: members } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", conversationId);

          if (members) {
            const memberIds = members
              .map((m) => m.user_id)
              .filter((id) => id !== user.id);

            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .in("id", memberIds);

            setGroupMembers((profiles as OtherUser[]) ?? []);
          }
        } else {
          // DM: fetch other user
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
    };

    fetchInfo();
  }, [user, conversationId]);

  // Load pinned messages
  useEffect(() => {
    if (!conversationId) return;
    getPinnedMessages(conversationId).then(setPinnedMessages).catch(() => {});
  }, [conversationId, messages.length]);

  // Mark conversation as read
  useEffect(() => {
    if (!user || !conversationId) return;
    markConversationRead(conversationId, user.id);
  }, [user, conversationId, messages.length]);

  const handleSend = async (content: string) => {
    if (!user) return;
    await sendMessage(conversationId, user.id, content);
  };

  const toggleEncryption = async () => {
    const supabase = createClient();
    const newValue = !isEncrypted;
    const { error } = await supabase
      .from("conversations")
      .update({ is_encrypted: newValue })
      .eq("id", conversationId);

    if (!error) {
      setIsEncrypted(newValue);
    }
  };

  const handlePinMessage = async (messageId: string, isPinned: boolean) => {
    try {
      if (isPinned) {
        await unpinMessage(messageId);
      } else {
        await pinMessage(messageId);
      }
      const updated = await getPinnedMessages(conversationId);
      setPinnedMessages(updated);
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    } catch {
      // Silently fail
    }
  };

  if (authLoading) {
    return (
      <div className="border-x border-border min-h-screen flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
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

  // Determine call peer info (for DMs)
  const callPeer = otherUser
    ? { id: otherUser.id, display_name: otherUser.display_name, avatar_url: otherUser.avatar_url }
    : groupMembers.length > 0
      ? { id: groupMembers[0].id, display_name: headerName, avatar_url: conversationInfo?.avatar_url ?? null }
      : null;

  return (
    <div className="border-x border-border min-h-screen flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/messages")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="size-5"
          >
            <path
              fillRule="evenodd"
              d="M7.28 7.72a.75.75 0 0 1 0 1.06L4.56 11.5H21a.75.75 0 0 1 0 1.5H4.56l2.72 2.72a.75.75 0 1 1-1.06 1.06l-4-4a.75.75 0 0 1 0-1.06l4-4a.75.75 0 0 1 1.06 0Z"
              clipRule="evenodd"
            />
          </svg>
        </Button>

        {loadingOther ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
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
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-violet-400" />
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
              <p className="text-sm font-semibold leading-none truncate">
                {headerName}
              </p>
              {headerSubtext && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {headerSubtext}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Encryption toggle */}
        <button
          onClick={toggleEncryption}
          className={cn(
            "h-8 w-8 flex items-center justify-center rounded-full transition-colors shrink-0",
            isEncrypted
              ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
              : "text-muted-foreground hover:bg-muted/50"
          )}
          title={isEncrypted ? "Encryption enabled" : "Enable encryption"}
        >
          <Lock className="h-4 w-4" />
        </button>

        {/* Call buttons */}
        {!loadingOther && callPeer && (
          <CallButton
            onVoiceCall={() => webrtc.startCall(false)}
            onVideoCall={() => webrtc.startCall(true)}
          />
        )}
      </div>

      {/* Encrypted Banner */}
      {isEncrypted && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/[0.05] border-b border-emerald-500/10">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium text-emerald-400">
            Messages are end-to-end encrypted
          </span>
        </div>
      )}

      {/* Pinned Messages Section */}
      {pinnedMessages.length > 0 && (
        <div className="border-b border-border bg-amber-500/[0.03]">
          <button
            onClick={() => setPinnedExpanded(!pinnedExpanded)}
            className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-amber-500/[0.05] transition-colors"
          >
            <Pin className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-xs font-medium text-amber-400">
              {pinnedMessages.length} pinned message{pinnedMessages.length !== 1 ? "s" : ""}
            </span>
            {pinnedExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-amber-400 ml-auto" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-amber-400 ml-auto" />
            )}
          </button>
          {pinnedExpanded && (
            <div className="px-4 pb-3 space-y-2">
              {pinnedMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/[0.05] border border-amber-500/10"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-amber-300">
                      {msg.sender?.display_name}
                    </p>
                    <p className="text-xs text-zinc-300 mt-0.5 line-clamp-2">
                      {msg.content || "Media"}
                    </p>
                  </div>
                  <button
                    onClick={() => handlePinMessage(msg.id, true)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                    title="Unpin"
                  >
                    <Pin className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <svg
            className="size-6 animate-spin text-muted-foreground"
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
        </div>
      ) : messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-1">Send the first message below.</p>
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

      {/* Input */}
      <MessageInput onSend={handleSend} />

      {/* Call Overlay */}
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
