"use client";

import { useState, useCallback } from "react";
import { UserPlus, AlertCircle, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ModalShell, Field, Input } from "@/components/orbit/forms";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import { searchUsers, type ProfileSummary } from "@/lib/queries/social";
import { inviteCommunityUser } from "@/lib/queries/communities";

interface InviteMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  communityName: string;
}

export function InviteMembersDialog({
  open,
  onOpenChange,
  communityId,
  communityName,
}: InviteMembersDialogProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

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
        toast.error("Couldn't search users");
      } finally {
        setSearching(false);
      }
    },
    [user?.id]
  );

  const handleInvite = async (profile: ProfileSummary) => {
    setInviting(profile.id);
    try {
      // Server-side RPC: owner/moderator only, no-op if already a member.
      await inviteCommunityUser(communityId, profile.id);
      setInvitedIds((prev) => new Set(prev).add(profile.id));
      toast.success(`Added @${profile.username} to ${communityName}`);
    } catch (e) {
      console.error("inviteCommunityUser failed", e);
      toast.error("Couldn't invite this user");
    } finally {
      setInviting(null);
    }
  };

  const reset = () => {
    setSearchQuery("");
    setSearchResults([]);
    setInvitedIds(new Set());
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
        <DialogTitle className="sr-only">Invite people</DialogTitle>
        <ModalShell
          title="Invite people"
          subtitle={`Search someone to bring into ${communityName}.`}
          icon={<UserPlus className="h-[17px] w-[17px]" strokeWidth={1.8} />}
          primaryLabel="Invite"
          canSubmit={false}
          onClose={() => onOpenChange(false)}
          onSecondary={() => onOpenChange(false)}
          secondaryLabel="Close"
        >
          <Field label="Who">
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
              {searchResults.map((p) => {
                const invited = invitedIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => !invited && handleInvite(p)}
                    disabled={inviting === p.id || invited}
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
                      {inviting === p.id ? "…" : invited ? "Invited" : "Invite"}
                    </span>
                  </button>
                );
              })}
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
