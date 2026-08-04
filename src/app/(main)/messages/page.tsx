"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Input as BareInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConversationList } from "@/components/messages/conversation-list";
import { CreateGroupDialog } from "@/components/messages/create-group-dialog";
import { NewConversationDialog } from "@/components/messages/new-conversation-dialog";
import { useConversations } from "@/lib/hooks/use-messages";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  closeConversation,
  markConversationRead,
  type ConversationWithPreview,
} from "@/lib/queries/messages";
import { OrbitErrorState } from "@/components/orbit/error-state";
import { cn } from "@/lib/utils";

type Tab = "inbox" | "requests";

export default function MessagesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: conversations, isLoading, isError, refetch } = useConversations();
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newConvoDialogOpen, setNewConvoDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("inbox");
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = c.is_group ? c.name : c.other_member?.display_name;
      const username = c.other_member?.username;
      const lastMsg = c.last_message?.content;
      return (
        (name && name.toLowerCase().includes(q)) ||
        (username && username.toLowerCase().includes(q)) ||
        (lastMsg && lastMsg.toLowerCase().includes(q))
      );
    });
  }, [conversations, search]);

  const inbox = filteredConversations.filter((c) => !c.is_request);
  const requests = filteredConversations.filter((c) => c.is_request);
  // The tab bar only exists while there are requests, so never strand the
  // viewer on an empty Requests tab after they clear the last one.
  const activeTab: Tab = requests.length > 0 ? tab : "inbox";

  const patchConversations = (
    apply: (list: ConversationWithPreview[]) => ConversationWithPreview[]
  ) =>
    queryClient.setQueryData<ConversationWithPreview[]>(
      ["conversations", user?.id],
      (list) => (list ? apply(list) : list)
    );

  const refreshBadges = () => {
    queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
    queryClient.invalidateQueries({
      queryKey: ["unread-messages-count", user?.id],
    });
  };

  // Accepting is a read: request-ness is derived partly from "never read", so
  // marking it read is what moves the thread into the inbox. Opening it does
  // the same thing, which is why there is no separate accept write.
  const handleAcceptRequest = async (conversation: ConversationWithPreview) => {
    if (!user || pendingRequestId) return;
    setPendingRequestId(conversation.id);
    patchConversations((list) =>
      list.map((c) =>
        c.id === conversation.id ? { ...c, is_request: false, unread: false } : c
      )
    );
    try {
      await markConversationRead(conversation.id, user.id);
      refreshBadges();
    } catch (e) {
      console.error("accept request failed", e);
      patchConversations((list) =>
        list.map((c) => (c.id === conversation.id ? conversation : c))
      );
      toast.error("Couldn't accept this request");
    } finally {
      setPendingRequestId(null);
    }
  };

  // Declining reuses the close-conversation mechanism: hidden_at hides the
  // thread until something newer arrives, so nothing is deleted and a new
  // message from them comes back as a fresh request.
  const handleDeclineRequest = async (conversation: ConversationWithPreview) => {
    if (!user || pendingRequestId) return;
    setPendingRequestId(conversation.id);
    patchConversations((list) => list.filter((c) => c.id !== conversation.id));
    try {
      await closeConversation(conversation.id, user.id);
      refreshBadges();
      toast.success("Request declined");
    } catch (e) {
      console.error("decline request failed", e);
      patchConversations((list) => [conversation, ...list]);
      toast.error("Couldn't decline this request");
    } finally {
      setPendingRequestId(null);
    }
  };

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      {/* Editorial hero */}
      <div className="flex flex-wrap items-end justify-between gap-[18px]">
        <div>
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            ◇&nbsp;&nbsp;DIRECT MESSAGES
          </p>
          <h1 className="mt-2 text-4xl sm:text-5xl font-extrabold tracking-tight">
            Said <span className="text-primary">quietly</span>.
          </h1>
          <p className="mt-2 max-w-[540px] text-sm text-text-secondary">
            One-to-one and small-group chat. End-to-end where it matters.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setGroupDialogOpen(true)}
          >
            <Users className="h-3.5 w-3.5" strokeWidth={1.8} />
            New group
          </Button>
          <Button size="lg" onClick={() => setNewConvoDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
            New
          </Button>
        </div>
      </div>

      {/* List panel */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-2.5 border-b border-border px-[18px] py-3.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <BareInput
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border-0 bg-transparent h-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
          />
        </div>

        {requests.length > 0 && (
          <div
            role="tablist"
            aria-label="Message folders"
            className="flex gap-1 border-b border-border px-3 py-2"
          >
            {(
              [
                ["inbox", `Inbox${inbox.length > 0 ? ` · ${inbox.length}` : ""}`],
                ["requests", `Requests · ${requests.length}`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  activeTab === key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {isError ? (
          <OrbitErrorState
            headline="Couldn't load your"
            accentWord="messages"
            sub="Something went wrong fetching your conversations."
            onRetry={() => refetch()}
          />
        ) : activeTab === "requests" ? (
          <ConversationList
            conversations={requests}
            isLoading={isLoading}
            requestActions={{
              onAccept: handleAcceptRequest,
              onDecline: handleDeclineRequest,
              pendingId: pendingRequestId,
            }}
          />
        ) : (
          <ConversationList conversations={inbox} isLoading={isLoading} />
        )}
      </div>

      <CreateGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
      />

      <NewConversationDialog
        open={newConvoDialogOpen}
        onOpenChange={setNewConvoDialogOpen}
      />
    </div>
  );
}
