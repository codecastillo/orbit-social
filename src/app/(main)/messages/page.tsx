"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Users } from "lucide-react";
import { Input as BareInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConversationList } from "@/components/messages/conversation-list";
import { CreateGroupDialog } from "@/components/messages/create-group-dialog";
import { NewConversationDialog } from "@/components/messages/new-conversation-dialog";
import { useConversations } from "@/lib/hooks/use-messages";
import { OrbitErrorState } from "@/components/orbit/error-state";

export default function MessagesPage() {
  const { data: conversations, isLoading, isError, refetch } = useConversations();
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newConvoDialogOpen, setNewConvoDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

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

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      {/* Editorial hero */}
      <div className="flex flex-wrap items-end justify-between gap-[18px]">
        <div>
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            ◇&nbsp;&nbsp;DIRECT MESSAGES
          </p>
          <h1 className="mt-2 text-5xl font-extrabold tracking-tight">
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

        {isError ? (
          <OrbitErrorState
            headline="Couldn't"
            accentWord="reach"
            sub="Your connection to the server stuttered. It's probably fine, try again."
            errorCode="ERR · CONN_TIMEOUT"
            onRetry={() => refetch()}
          />
        ) : (
          <ConversationList
            conversations={filteredConversations}
            isLoading={isLoading}
          />
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
