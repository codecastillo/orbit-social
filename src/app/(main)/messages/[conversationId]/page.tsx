"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Users,
  Pin,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Lock,
  ArrowLeft,
} from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useWebRTC } from "@/lib/hooks/use-webrtc";
import { cn } from "@/lib/utils";
import { O, aurora, panel } from "@/lib/design/orbit";
import { Eyebrow, PillBtn } from "@/components/orbit/primitives";

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
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [pinnedExpanded, setPinnedExpanded] = useState(false);

  const webrtc = useWebRTC(conversationId, user?.id ?? "");

  useEffect(() => {
    if (!user || !conversationId) return;
    (async () => {
      const supabase = createClient();
      const { data: conv } = await supabase
        .from("conversations")
        .select("is_group, is_encrypted, name, avatar_url, created_by")
        .eq("id", conversationId)
        .single();

      if (conv) {
        setConversationInfo(conv);
        setIsEncrypted(conv.is_encrypted ?? false);

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

  const toggleEncryption = async () => {
    const supabase = createClient();
    const next = !isEncrypted;
    const { error } = await supabase
      .from("conversations")
      .update({ is_encrypted: next })
      .eq("id", conversationId);
    if (!error) setIsEncrypted(next);
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
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-2xl" />
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
    <div
      style={{
        color: O.ink,
        fontFamily: O.sans,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 280px",
        gap: 18,
        height: "calc(100vh - 48px)",
      }}
      className="xl:grid-cols-[minmax(0,1fr)_280px] grid-cols-1"
    >
      {/* CHAT PANEL */}
      <div
        style={{
          ...panel(),
          padding: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* Header — frosted, rounded chips */}
        <div
          style={{
            borderBottom: `1px solid ${O.hair}`,
          }}
        >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push("/messages")}
            className="h-10 w-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {loadingOther ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-2xl" />
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
                  <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-500/25 to-cyan-500/20 border border-white/[0.06] flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-violet-300" />
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

          <button
            onClick={toggleEncryption}
            className={cn(
              "h-10 w-10 rounded-2xl flex items-center justify-center transition-colors shrink-0 border",
              isEncrypted
                ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                : "text-muted-foreground bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08]"
            )}
            title={isEncrypted ? "Encryption enabled" : "Enable encryption"}
          >
            <Lock className="h-4 w-4" />
          </button>

          {!loadingOther && callPeer && (
            <CallButton
              onVoiceCall={() => webrtc.startCall(false)}
              onVideoCall={() => webrtc.startCall(true)}
            />
          )}
        </div>

        {isEncrypted && (
          <div className="flex items-center gap-2 px-5 py-2 bg-emerald-500/[0.06] border-t border-emerald-500/10">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
            <span className="text-[11px] font-semibold text-emerald-300">
              Messages are end-to-end encrypted
            </span>
          </div>
        )}

        {pinnedMessages.length > 0 && (
          <div className="border-t border-amber-500/10 bg-amber-500/[0.04]">
            <button
              onClick={() => setPinnedExpanded(!pinnedExpanded)}
              className="flex items-center gap-2 w-full px-5 py-2 text-left hover:bg-amber-500/[0.08] transition-colors"
            >
              <Pin className="h-3.5 w-3.5 text-amber-300 shrink-0" />
              <span className="text-[11px] font-semibold text-amber-300">
                {pinnedMessages.length} pinned message
                {pinnedMessages.length !== 1 ? "s" : ""}
              </span>
              {pinnedExpanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-amber-300 ml-auto" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-amber-300 ml-auto" />
              )}
            </button>
            {pinnedExpanded && (
              <div className="px-5 pb-3 space-y-2">
                {pinnedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="flex items-start gap-2 p-2.5 rounded-2xl bg-amber-500/[0.06] border border-amber-500/15"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-amber-200">
                        {msg.sender?.display_name}
                      </p>
                      <p className="text-xs text-foreground/85 mt-0.5 line-clamp-2">
                        {msg.content || "Media"}
                      </p>
                    </div>
                    <button
                      onClick={() => handlePinMessage(msg.id, true)}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
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
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-white/15 border-t-primary animate-spin" />
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
        <aside
          style={{
            ...panel(),
            padding: 22,
            overflow: "auto",
            height: "fit-content",
            maxHeight: "calc(100vh - 48px)",
            position: "sticky",
            top: 24,
          }}
          className="hidden xl:block"
        >
          <div
            style={{
              textAlign: "center",
              paddingBottom: 20,
              borderBottom: `1px solid ${O.hair}`,
            }}
          >
            {isGroup ? (
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: "50%",
                  margin: "0 auto",
                  background: aurora,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "white",
                }}
              >
                {headerName[0]?.toUpperCase()}
              </div>
            ) : otherUser ? (
              <div style={{ display: "inline-block" }}>
                <UserAvatar
                  src={otherUser.avatar_url}
                  fallback={otherUser.display_name}
                  size="xl"
                />
              </div>
            ) : null}
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 10 }}>
              {headerName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: O.ink3,
                fontFamily: O.mono,
                letterSpacing: "0.06em",
              }}
            >
              {isGroup
                ? `${groupMembers.length + 1} MEMBERS`
                : `@${otherUser?.username.toUpperCase()}`}
            </div>
            {!isGroup && otherUser && (
              <Link href={`/${otherUser.username}`} style={{ textDecoration: "none" }}>
                <PillBtn size="sm" style={{ marginTop: 12 }}>
                  View profile →
                </PillBtn>
              </Link>
            )}
          </div>

          {pinnedMessages.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <Eyebrow accent>
                ◇&nbsp;&nbsp;PINNED · {pinnedMessages.length}
              </Eyebrow>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {pinnedMessages.slice(0, 3).map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      background: "rgba(255,215,106,0.06)",
                      border: "1px solid rgba(255,215,106,0.18)",
                      fontSize: 12,
                      color: O.ink2,
                      lineHeight: 1.4,
                    }}
                  >
                    {(m.content || "Media").slice(0, 60)}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <Eyebrow>◈&nbsp;&nbsp;ACTIONS</Eyebrow>
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={toggleEncryption}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontSize: 13,
                  color: isEncrypted ? "#7dffa3" : O.ink2,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  background: "transparent",
                  border: "none",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                <Lock style={{ width: 14, height: 14 }} strokeWidth={1.8} />
                {isEncrypted ? "Encryption on" : "Enable encryption"}
              </button>
              {!isGroup && otherUser && (
                <button
                  type="button"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    fontSize: 13,
                    color: O.ink2,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                    background: "transparent",
                    border: "none",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  <Pin style={{ width: 14, height: 14 }} strokeWidth={1.8} />
                  Pin conversation
                </button>
              )}
              {!isGroup && otherUser && (
                <button
                  type="button"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    fontSize: 13,
                    color: "#ff6a7a",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                    background: "transparent",
                    border: "none",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  <ShieldCheck style={{ width: 14, height: 14 }} strokeWidth={1.8} />
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
