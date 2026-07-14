"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Edit3, AlertCircle, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalShell, Field, Input } from "@/components/orbit/forms";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import { searchUsers, type ProfileSummary } from "@/lib/queries/social";
import { getOrCreateDMConversation } from "@/lib/queries/messages";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewConversationDialog({
  open,
  onOpenChange,
}: NewConversationDialogProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [navigating, setNavigating] = useState<string | null>(null);

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (query.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const results = await searchUsers(query, 10);
        setSearchResults(results.filter((r) => r.id !== user?.id));
      } catch {
        toast.error("Failed to search users");
      } finally {
        setSearching(false);
      }
    },
    [user?.id]
  );

  const handleSelectUser = async (profile: ProfileSummary) => {
    if (!user) return;
    setNavigating(profile.id);
    try {
      const conversationId = await getOrCreateDMConversation(user.id, profile.id);
      onOpenChange(false);
      reset();
      router.push(`/messages/${conversationId}`);
    } catch (e) {
      const msg = (e as { message?: string } | undefined)?.message;
      console.error("getOrCreateDMConversation failed", e);
      toast.error(msg ? `Failed: ${msg}` : "Failed to start conversation");
    } finally {
      setNavigating(null);
    }
  };

  const reset = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) reset();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 border-0 bg-transparent shadow-none max-w-none w-auto ring-0"
      >
        <ModalShell
          title="New conversation"
          subtitle="Search someone to start talking to."
          icon={<Edit3 className="h-[17px] w-[17px]" strokeWidth={1.8} />}
          primaryLabel="Start"
          canSubmit={false}
          onClose={() => onOpenChange(false)}
          onSecondary={() => onOpenChange(false)}
          secondaryLabel="Close"
        >
          <Field label="To">
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or @handle…"
              prefix={
                <Search
                  className="h-3.5 w-3.5 text-muted-foreground"
                  strokeWidth={1.8}
                />
              }
              autoFocus
            />
          </Field>

          {searching && (
            <div className="mb-[18px] flex items-center gap-2.5 rounded-xl border border-border bg-surface-elevated px-4 py-3.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Searching…</span>
            </div>
          )}

          {searchQuery.trim().length === 0 && (
            <div className="mb-[18px] flex items-center gap-2.5 rounded-xl border border-border bg-surface-elevated px-4 py-3.5">
              <AlertCircle
                className="h-3.5 w-3.5 text-muted-foreground"
                strokeWidth={1.6}
              />
              <span className="text-xs text-muted-foreground">
                Type at least 2 characters to search
              </span>
            </div>
          )}

          {searchResults.length > 0 && (
            <>
              <div className="mb-2.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-muted-foreground">
                RESULTS
              </div>
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectUser(p)}
                  disabled={navigating === p.id}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2.5 text-left text-foreground disabled:opacity-50"
                >
                  <UserAvatar
                    src={p.avatar_url}
                    fallback={p.display_name}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">
                      {p.display_name}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      @{p.username}
                    </div>
                  </div>
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[11.5px] font-medium text-foreground">
                    {navigating === p.id ? "…" : "Message"}
                  </span>
                </button>
              ))}
            </>
          )}

          {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No users found
            </p>
          )}
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}
