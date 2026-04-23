"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { useMessages } from "@/lib/hooks/use-messages";
import { sendMessage, markConversationRead } from "@/lib/queries/messages";
import { createClient } from "@/lib/supabase/client";
import { ChatWindow } from "@/components/messages/chat-window";
import { MessageInput } from "@/components/messages/message-input";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ChatPageProps {
  params: Promise<{ conversationId: string }>;
}

interface OtherUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export default function ChatPage({ params }: ChatPageProps) {
  const { conversationId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const { messages, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useMessages(conversationId);
  const router = useRouter();
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loadingOther, setLoadingOther] = useState(true);

  // Fetch the other user's profile
  useEffect(() => {
    if (!user || !conversationId) return;

    const fetchOtherUser = async () => {
      const supabase = createClient();

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

      setLoadingOther(false);
    };

    fetchOtherUser();
  }, [user, conversationId]);

  // Mark conversation as read
  useEffect(() => {
    if (!user || !conversationId) return;
    markConversationRead(conversationId, user.id);
  }, [user, conversationId, messages.length]);

  const handleSend = async (content: string) => {
    if (!user) return;
    await sendMessage(conversationId, user.id, content);
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
        ) : otherUser ? (
          <div className="flex items-center gap-3">
            <UserAvatar
              src={otherUser.avatar_url}
              fallback={otherUser.display_name}
              size="sm"
            />
            <div>
              <p className="text-sm font-semibold leading-none">
                {otherUser.display_name}
              </p>
              <p className="text-xs text-muted-foreground">
                @{otherUser.username}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Conversation</span>
        )}
      </div>

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
        />
      )}

      {/* Input */}
      <MessageInput onSend={handleSend} />
    </div>
  );
}
