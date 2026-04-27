"use client";

import Link from "next/link";
import { Users, Pin } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatTimeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConversationWithPreview } from "@/lib/queries/messages";

interface ConversationListProps {
  conversations: ConversationWithPreview[];
  isLoading?: boolean;
}

export function ConversationList({
  conversations,
  isLoading,
}: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="h-12 w-12 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="size-6"
          >
            <path
              fillRule="evenodd"
              d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97ZM6.75 8.25a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H7.5Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <p className="text-lg font-medium">No conversations yet</p>
        <p className="text-sm mt-1">Start a conversation with someone.</p>
      </div>
    );
  }

  const pinned = conversations.filter((c) => c.is_pinned);
  const others = conversations.filter((c) => !c.is_pinned);

  return (
    <div>
      {pinned.length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 text-amber-300/80">
            <Pin className="h-3 w-3" />
            <span className="text-[10px] font-mono tracking-[0.14em] font-semibold">
              PINNED · {pinned.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {pinned.map((c) => (
              <ConversationRow key={c.id} conversation={c} />
            ))}
          </div>
          {others.length > 0 && (
            <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-muted-foreground border-t border-border">
              <span className="text-[10px] font-mono tracking-[0.14em] font-semibold">
                ALL · {others.length}
              </span>
            </div>
          )}
        </div>
      )}
      <div className="divide-y divide-border">
        {others.map((c) => (
          <ConversationRow key={c.id} conversation={c} />
        ))}
      </div>
    </div>
  );
}

function ConversationRow({ conversation }: { conversation: ConversationWithPreview }) {
  const isGroup = conversation.is_group;
  const displayName = isGroup
    ? conversation.name || "Group Chat"
    : conversation.other_member?.display_name || conversation.name || "Unknown";
  const avatarUrl = isGroup
    ? conversation.avatar_url
    : conversation.other_member?.avatar_url || conversation.avatar_url;

  let preview = "";
  if (conversation.last_message) {
    if (conversation.last_message.is_deleted) {
      preview = "Message deleted";
    } else {
      preview = conversation.last_message.content || "Sent media";
    }
  }

  return (
    <Link
      href={`/messages/${conversation.id}`}
      className={cn(
        "flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors",
        conversation.unread && "bg-muted/30"
      )}
    >
      {isGroup ? (
        avatarUrl ? (
          <UserAvatar src={avatarUrl} fallback={displayName} size="lg" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-violet-400" />
          </div>
        )
      ) : (
        <UserAvatar src={avatarUrl} fallback={displayName} size="lg" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {conversation.is_pinned && (
              <Pin className="h-3 w-3 text-amber-400 shrink-0" />
            )}
            <span
              className={cn(
                "text-sm truncate",
                conversation.unread
                  ? "font-semibold text-foreground"
                  : "font-medium text-foreground"
              )}
            >
              {displayName}
            </span>
            {isGroup && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0">
                Group
              </span>
            )}
          </div>
          {conversation.last_message && (
            <span className="text-xs text-muted-foreground shrink-0">
              {formatTimeAgo(conversation.last_message.created_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-sm truncate",
              conversation.unread ? "text-foreground/80" : "text-muted-foreground"
            )}
          >
            {preview}
          </p>
          {conversation.unread && (
            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
          )}
        </div>
      </div>
    </Link>
  );
}
