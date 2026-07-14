"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Users, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalShell, Field, Input } from "@/components/orbit/forms";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import { searchUsers, type ProfileSummary } from "@/lib/queries/social";
import { createGroupConversation } from "@/lib/queries/messages";

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupDialog({
  open,
  onOpenChange,
}: CreateGroupDialogProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileSummary[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<ProfileSummary[]>([]);
  const [creating, setCreating] = useState(false);

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (query.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      try {
        const results = await searchUsers(query, 10);
        const filtered = results.filter(
          (r) =>
            r.id !== user?.id &&
            !selectedUsers.some((s) => s.id === r.id),
        );
        setSearchResults(filtered);
      } catch {
        toast.error("Failed to search users");
      }
    },
    [user?.id, selectedUsers],
  );

  const addUser = (profile: ProfileSummary) => {
    setSelectedUsers((prev) => [...prev, profile]);
    setSearchResults((prev) => prev.filter((r) => r.id !== profile.id));
    setSearchQuery("");
  };

  const removeUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const reset = () => {
    setGroupName("");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedUsers([]);
  };

  const handleCreate = async () => {
    if (!user || !groupName.trim() || selectedUsers.length === 0) return;
    setCreating(true);
    try {
      const conversationId = await createGroupConversation(
        user.id,
        groupName.trim(),
        selectedUsers.map((u) => u.id),
      );
      toast.success("Group created!");
      onOpenChange(false);
      reset();
      router.push(`/messages/${conversationId}`);
    } catch {
      toast.error("Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit =
    groupName.trim().length > 0 && selectedUsers.length > 0 && !creating;

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
          title="New group"
          subtitle="A conversation between more than two."
          icon={<Users className="h-[17px] w-[17px]" strokeWidth={1.8} />}
          width={540}
          primaryLabel={creating ? "Creating…" : "Create group"}
          secondaryLabel="Cancel"
          canSubmit={canSubmit}
          loading={creating}
          onPrimary={handleCreate}
          onSecondary={() => onOpenChange(false)}
          onClose={() => onOpenChange(false)}
        >
          <Field label="Group name" hint="optional">
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Film photographers, sf trip"
              maxLength={50}
              autoFocus
            />
          </Field>

          <Field
            label="Members"
            hint={`${selectedUsers.length} selected`}
          >
            <div className="flex min-h-20 flex-wrap items-start gap-1.5 rounded-xl border border-border bg-surface-elevated p-2.5">
              {selectedUsers.map((u) => (
                <div
                  key={u.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 py-1 pl-1 pr-2.5"
                >
                  <UserAvatar
                    src={u.avatar_url}
                    fallback={u.display_name}
                    size="sm"
                  />
                  <span className="text-xs font-medium text-foreground">
                    {u.display_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeUser(u.id)}
                    aria-label={`Remove ${u.display_name}`}
                    className="flex cursor-pointer items-center text-muted-foreground"
                  >
                    <X className="h-2.5 w-2.5" strokeWidth={2} />
                  </button>
                </div>
              ))}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search someone to add…"
                className="min-w-[160px] flex-1 bg-transparent px-2.5 py-1 text-xs text-foreground outline-none"
              />
            </div>
          </Field>

          {searchResults.length > 0 && (
            <>
              <div className="mb-2.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-muted-foreground">
                RESULTS
              </div>
              {searchResults.map((p) => (
                <div
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl p-2.5"
                  onClick={() => addUser(p)}
                >
                  <UserAvatar
                    src={p.avatar_url}
                    fallback={p.display_name}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-foreground">
                      {p.display_name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      @{p.username}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Add ${p.display_name}`}
                    className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-lg border border-border bg-surface-elevated text-text-secondary"
                  >
                    <Plus className="h-[13px] w-[13px]" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </>
          )}
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}
