"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, PenLine, Users, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationList } from "@/components/messages/conversation-list";
import { CreateGroupDialog } from "@/components/messages/create-group-dialog";
import { NewConversationDialog } from "@/components/messages/new-conversation-dialog";
import { useConversations } from "@/lib/hooks/use-messages";

export default function MessagesPage() {
  const { data: conversations, isLoading, isError, refetch } = useConversations();
  const router = useRouter();
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newConvoDialogOpen, setNewConvoDialogOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Header -- frosted glass with pen icon */}
      <div className="sticky top-0 z-10 backdrop-blur-2xl bg-background/80 shadow-[0_1px_0_oklch(1_0_0_/_0.06)]">
        <div className="flex items-center justify-between h-14 px-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <MessageCircle className="h-4.5 w-4.5 text-blue-400" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">Chat</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-white/[0.04] backdrop-blur-xl hover:bg-white/[0.08] transition-all border border-white/[0.06]"
              onClick={() => setGroupDialogOpen(true)}
              title="New group chat"
            >
              <Users className="h-4.5 w-4.5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-white/[0.04] backdrop-blur-xl hover:bg-white/[0.08] transition-all border border-white/[0.06]"
              onClick={() => setNewConvoDialogOpen(true)}
            >
              <PenLine className="h-4.5 w-4.5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-5">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <p className="text-base font-semibold text-muted-foreground">Something went wrong</p>
          <p className="text-sm text-muted-foreground/60 mt-1.5">
            Failed to load conversations. Please try again.
          </p>
          <button
            onClick={() => refetch()}
            className="text-primary text-sm font-medium hover:underline mt-3"
          >
            Retry
          </button>
        </div>
      ) : (
        <ConversationList
          conversations={conversations ?? []}
          isLoading={isLoading}
        />
      )}

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
