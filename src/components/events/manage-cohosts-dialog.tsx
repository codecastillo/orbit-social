"use client";

import { useState, useCallback } from "react";
import { UsersRound, AlertCircle, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ModalShell, Field, Input } from "@/components/orbit/forms";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import { searchUsers, type ProfileSummary } from "@/lib/queries/social";
import {
  addEventCohost,
  removeEventCohost,
  type EventCohost,
} from "@/lib/queries/events";

interface ManageCohostsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  cohosts: EventCohost[];
  onChanged: () => void;
}

// Host-only management of event co-hosts, same search-to-add flow as the
// community invite dialog. Co-hosts are display and credit only for v1: the
// events UPDATE policy is creator-only, so they get no edit rights.
export function ManageCohostsDialog({
  open,
  onOpenChange,
  eventId,
  cohosts,
  onChanged,
}: ManageCohostsDialogProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const cohostIds = new Set(cohosts.map((c) => c.user_id));

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

  const handleAdd = async (profile: ProfileSummary) => {
    setPendingId(profile.id);
    try {
      await addEventCohost(eventId, profile.id);
      toast.success(`Added @${profile.username} as a co-host`);
      onChanged();
    } catch (e) {
      console.error("addEventCohost failed", e);
      toast.error("Couldn't add this co-host");
    } finally {
      setPendingId(null);
    }
  };

  const handleRemove = async (cohost: EventCohost) => {
    setPendingId(cohost.user_id);
    try {
      await removeEventCohost(eventId, cohost.user_id);
      onChanged();
    } catch (e) {
      console.error("removeEventCohost failed", e);
      toast.error("Couldn't remove this co-host");
    } finally {
      setPendingId(null);
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
        <DialogTitle className="sr-only">Manage co-hosts</DialogTitle>
        <ModalShell
          title="Manage co-hosts"
          subtitle="Co-hosts show next to you on the event page."
          icon={<UsersRound className="h-[17px] w-[17px]" strokeWidth={1.8} />}
          primaryLabel="Add"
          canSubmit={false}
          onClose={() => onOpenChange(false)}
          onSecondary={() => onOpenChange(false)}
          secondaryLabel="Close"
        >
          {cohosts.length > 0 && (
            <>
              <div className="mb-2.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-muted-foreground">
                CO-HOSTS
              </div>
              <div className="mb-[18px]">
                {cohosts.map((cohost) => (
                  <div
                    key={cohost.user_id}
                    className="flex items-center gap-3 rounded-xl p-2.5"
                  >
                    <UserAvatar
                      src={cohost.profiles.avatar_url}
                      fallback={
                        cohost.profiles.display_name || cohost.profiles.username
                      }
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold">
                        {cohost.profiles.display_name}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">
                        @{cohost.profiles.username}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(cohost)}
                      disabled={pendingId === cohost.user_id}
                      aria-label={`Remove @${cohost.profiles.username} as co-host`}
                      className="cursor-pointer rounded-full p-1.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                    >
                      <X className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <Field label="Add a co-host">
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

          {searchQuery.trim().length === 0 && cohosts.length === 0 && (
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
                const added = cohostIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => !added && handleAdd(p)}
                    disabled={pendingId === p.id || added}
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
                      {pendingId === p.id ? "…" : added ? "Co-host" : "Add"}
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
