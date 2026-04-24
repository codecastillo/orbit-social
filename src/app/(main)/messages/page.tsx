"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, PenLine, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationList } from "@/components/messages/conversation-list";
import { CreateGroupDialog } from "@/components/messages/create-group-dialog";
import { useConversations } from "@/lib/hooks/use-messages";

export default function MessagesPage() {
  const { data: conversations, isLoading } = useConversations();
  const router = useRouter();
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Header -- frosted glass with pen icon */}
      <div className="sticky top-0 z-10 bg-background/60 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <MessageCircle className="h-4.5 w-4.5 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Chat</h2>
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
              onClick={() => {
                // TODO: open new conversation dialog
              }}
            >
              <PenLine className="h-4.5 w-4.5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </div>

      <ConversationList
        conversations={conversations ?? []}
        isLoading={isLoading}
      />

      <CreateGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
      />
    </div>
  );
}
