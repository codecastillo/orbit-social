"use client";

import { useState, useCallback } from "react";
import { Users, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalShell, Field, Input } from "@/components/orbit/forms";
import { UserAvatar } from "@/components/shared/user-avatar";
import { searchUsers, type ProfileSummary } from "@/lib/queries/social";
import {
  addGroupMember,
  removeGroupMember,
  updateGroupName,
} from "@/lib/queries/messages";

interface GroupMember {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface GroupSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  groupName: string;
  /** Other members of the group, excluding the viewer. */
  members: GroupMember[];
  currentUserId: string;
  /** Called after any successful mutation so the page can refetch. */
  onChanged: () => void;
}

export function GroupSettingsDialog({
  open,
  onOpenChange,
  conversationId,
  groupName,
  members,
  currentUserId,
  onChanged,
}: GroupSettingsDialogProps) {
  const [name, setName] = useState(groupName);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileSummary[]>([]);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  // Re-seed the name field each time the dialog opens so a cancelled edit
  // doesn't linger into the next open. Adjusted during render per the React
  // "adjusting state when a prop changes" pattern.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setName(groupName);
  }

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (query.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      try {
        const results = await searchUsers(query, 10);
        setSearchResults(
          results.filter(
            (r) =>
              r.id !== currentUserId && !members.some((m) => m.id === r.id),
          ),
        );
      } catch {
        toast.error("Failed to search users");
      }
    },
    [currentUserId, members],
  );

  const handleRename = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === groupName || saving) return;
    setSaving(true);
    try {
      await updateGroupName(conversationId, trimmed);
      toast.success("Group renamed");
      onChanged();
      onOpenChange(false);
    } catch (e) {
      console.error("updateGroupName failed", e);
      toast.error("Couldn't rename group");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (profile: ProfileSummary) => {
    if (busyMemberId) return;
    setBusyMemberId(profile.id);
    try {
      await addGroupMember(conversationId, profile.id);
      toast.success(`@${profile.username} added`);
      setSearchQuery("");
      setSearchResults([]);
      onChanged();
    } catch (e) {
      console.error("addGroupMember failed", e);
      toast.error("Couldn't add member");
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleRemove = async (member: GroupMember) => {
    if (busyMemberId) return;
    setBusyMemberId(member.id);
    try {
      await removeGroupMember(conversationId, member.id);
      toast.success(`@${member.username} removed`);
      onChanged();
    } catch (e) {
      console.error("removeGroupMember failed", e);
      toast.error("Couldn't remove member");
    } finally {
      setBusyMemberId(null);
    }
  };

  const canSubmit =
    name.trim().length > 0 && name.trim() !== groupName && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 border-0 bg-transparent shadow-none max-w-none w-auto ring-0"
      >
        <ModalShell
          title="Group settings"
          subtitle="Rename the group or manage who's in it."
          icon={<Users className="h-[17px] w-[17px]" strokeWidth={1.8} />}
          width={540}
          primaryLabel={saving ? "Saving…" : "Save name"}
          secondaryLabel="Close"
          canSubmit={canSubmit}
          loading={saving}
          onPrimary={handleRename}
          onSecondary={() => onOpenChange(false)}
          onClose={() => onOpenChange(false)}
        >
          <Field label="Group name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Group name"
              maxLength={50}
            />
          </Field>

          <Field label="Members" hint={`${members.length + 1} total`}>
            <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface-elevated p-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg p-1.5">
                  <UserAvatar
                    src={m.avatar_url}
                    fallback={m.display_name}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-foreground">
                      {m.display_name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      @{m.username}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(m)}
                    disabled={busyMemberId === m.id}
                    aria-label={`Remove ${m.display_name}`}
                    className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    <X className="h-[13px] w-[13px]" strokeWidth={2} />
                  </button>
                </div>
              ))}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search someone to add…"
                className="min-w-[160px] flex-1 bg-transparent px-2.5 py-1.5 text-xs text-foreground outline-none"
              />
            </div>
          </Field>

          {searchResults.length > 0 && (
            <>
              <div className="mb-2.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-muted-foreground">
                RESULTS
              </div>
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleAdd(p)}
                  disabled={busyMemberId === p.id}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2.5 text-left disabled:opacity-50"
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
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-border bg-surface-elevated text-text-secondary">
                    <Plus className="h-[13px] w-[13px]" strokeWidth={2} />
                  </span>
                </button>
              ))}
            </>
          )}
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}
