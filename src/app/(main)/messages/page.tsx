"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Users } from "lucide-react";
import { Input as BareInput } from "@/components/ui/input";
import { ConversationList } from "@/components/messages/conversation-list";
import { CreateGroupDialog } from "@/components/messages/create-group-dialog";
import { NewConversationDialog } from "@/components/messages/new-conversation-dialog";
import { useConversations } from "@/lib/hooks/use-messages";
import { OrbitErrorState } from "@/components/orbit/error-state";
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";

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
    <div
      style={{
        color: O.ink,
        fontFamily: O.sans,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {/* Editorial hero */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Eyebrow>◇&nbsp;&nbsp;DIRECT MESSAGES</Eyebrow>
          <Display size={48} style={{ marginTop: 8 }}>
            Said <Acc>quietly</Acc>.
          </Display>
          <p
            style={{
              fontSize: 14,
              color: O.ink2,
              marginTop: 8,
              maxWidth: 540,
            }}
          >
            One-to-one and small-group chat. End-to-end where it matters.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <PillBtn size="lg" onClick={() => setGroupDialogOpen(true)}>
            <Users style={{ width: 14, height: 14 }} strokeWidth={1.8} />
            New group
          </PillBtn>
          <PillBtn primary size="lg" onClick={() => setNewConvoDialogOpen(true)}>
            <Plus style={{ width: 14, height: 14 }} strokeWidth={2.4} />
            New
          </PillBtn>
        </div>
      </div>

      {/* List panel */}
      <div
        style={{
          ...panel(),
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px",
            borderBottom: `1px solid ${O.hair}`,
          }}
        >
          <Search style={{ width: 16, height: 16, color: O.ink3 }} />
          <BareInput
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border-0 bg-transparent h-9 text-sm text-white placeholder:text-white/40 focus-visible:ring-0"
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
