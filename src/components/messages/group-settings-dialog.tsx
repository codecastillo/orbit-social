"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  X,
  Plus,
  Camera,
  Shield,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ModalShell, Field, Input } from "@/components/orbit/forms";
import { ConfirmDialog } from "@/components/orbit/confirm-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { createClient } from "@/lib/supabase/client";
import { searchUsers, type ProfileSummary } from "@/lib/queries/social";
import {
  addGroupMember,
  removeGroupMember,
  updateGroupName,
  getGroupMembers,
  getConversationMembership,
  setConversationMuted,
  setGroupMemberRole,
  leaveConversation,
  uploadGroupAvatar,
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
  const router = useRouter();
  const [name, setName] = useState(groupName);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileSummary[]>([]);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  const [roleById, setRoleById] = useState<Map<string, string>>(new Map());
  const [createdBy, setCreatedBy] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<"member" | "admin">("member");
  const [muted, setMuted] = useState(false);
  const [muteSaving, setMuteSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Re-seed the name field each time the dialog opens so a cancelled edit
  // doesn't linger into the next open. Adjusted during render per the React
  // "adjusting state when a prop changes" pattern.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setName(groupName);
  }

  // Roles and the viewer's own membership aren't in the members prop (the
  // page only loads profiles), so fetch them here on open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [rows, membership, { data: conv }] = await Promise.all([
          getGroupMembers(conversationId),
          getConversationMembership(conversationId, currentUserId),
          createClient()
            .from("conversations")
            .select("created_by")
            .eq("id", conversationId)
            .single(),
        ]);
        if (cancelled) return;
        setRoleById(new Map(rows.map((r) => [r.user_id, r.role])));
        setMyRole(membership?.role ?? "member");
        setMuted(membership?.is_muted ?? false);
        setCreatedBy(conv?.created_by ?? null);
      } catch (e) {
        console.error("group settings load failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, conversationId, currentUserId, members]);

  const isCreator = createdBy === currentUserId;
  const isAdmin = isCreator || myRole === "admin";

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
        toast.error("Couldn't search users");
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

  const handleAvatarFile = async (file: File) => {
    if (avatarUploading) return;
    setAvatarUploading(true);
    try {
      await uploadGroupAvatar(currentUserId, conversationId, file);
      toast.success("Group photo updated");
      onChanged();
    } catch (e) {
      console.error("uploadGroupAvatar failed", e);
      toast.error(e instanceof Error ? e.message : "Couldn't upload photo");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleMuteToggle = async (next: boolean) => {
    if (muteSaving) return;
    setMuteSaving(true);
    setMuted(next);
    try {
      await setConversationMuted(conversationId, currentUserId, next);
    } catch (e) {
      console.error("setConversationMuted failed", e);
      setMuted(!next);
      toast.error("Couldn't update mute");
    } finally {
      setMuteSaving(false);
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

  const handleRoleToggle = async (member: GroupMember) => {
    if (busyMemberId) return;
    const nextRole = roleById.get(member.id) === "admin" ? "member" : "admin";
    setBusyMemberId(member.id);
    try {
      await setGroupMemberRole(conversationId, member.id, nextRole);
      setRoleById((prev) => new Map(prev).set(member.id, nextRole));
      toast.success(
        nextRole === "admin"
          ? `@${member.username} is now an admin`
          : `@${member.username} is no longer an admin`,
      );
      onChanged();
    } catch (e) {
      console.error("setGroupMemberRole failed", e);
      toast.error("Couldn't change role");
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleLeave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await leaveConversation(conversationId, currentUserId);
      toast.success("You left the group");
      onOpenChange(false);
      router.push("/messages");
    } catch (e) {
      console.error("leaveConversation failed", e);
      toast.error("Couldn't leave group");
    } finally {
      setLeaving(false);
    }
  };

  const canSubmit =
    isAdmin && name.trim().length > 0 && name.trim() !== groupName && !saving;

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
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Group name"
                maxLength={50}
                disabled={!isAdmin}
              />
              {isAdmin && (
                <>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarFile(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    aria-label="Change group photo"
                    title="Change group photo"
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface-elevated text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    <Camera className="h-[14px] w-[14px]" strokeWidth={1.8} />
                  </button>
                </>
              )}
            </div>
          </Field>

          <Field
            label="Mute"
            hint="Only affects your notifications"
          >
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated px-3 py-2.5">
              <span className="text-[13px] text-text-secondary">
                Mute message notifications
              </span>
              <Switch
                checked={muted}
                onCheckedChange={handleMuteToggle}
                disabled={muteSaving}
                aria-label="Mute message notifications"
              />
            </div>
          </Field>

          <Field label="Members" hint={`${members.length + 1} total`}>
            <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface-elevated p-2">
              {members.map((m) => {
                const memberIsAdmin = roleById.get(m.id) === "admin";
                return (
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
                        {memberIsAdmin && (
                          <span className="text-primary">
                            {" "}
                            · {m.id === createdBy ? "Creator" : "Admin"}
                          </span>
                        )}
                      </div>
                    </div>
                    {isCreator && m.id !== createdBy && (
                      <button
                        type="button"
                        onClick={() => handleRoleToggle(m)}
                        disabled={busyMemberId === m.id}
                        aria-label={
                          memberIsAdmin
                            ? `Remove ${m.display_name} as admin`
                            : `Make ${m.display_name} an admin`
                        }
                        title={memberIsAdmin ? "Remove admin" : "Make admin"}
                        className={`flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-lg border border-border bg-surface disabled:opacity-50 ${
                          memberIsAdmin
                            ? "text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {memberIsAdmin ? (
                          <ShieldCheck className="h-[13px] w-[13px]" strokeWidth={2} />
                        ) : (
                          <Shield className="h-[13px] w-[13px]" strokeWidth={2} />
                        )}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleRemove(m)}
                        disabled={busyMemberId === m.id}
                        aria-label={`Remove ${m.display_name}`}
                        className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground hover:text-destructive disabled:opacity-50"
                      >
                        <X className="h-[13px] w-[13px]" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                );
              })}
              {isAdmin && (
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search someone to add…"
                  className="min-w-[160px] flex-1 bg-transparent px-2.5 py-1.5 text-xs text-foreground outline-none"
                />
              )}
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

          <button
            type="button"
            onClick={() => setLeaveConfirmOpen(true)}
            disabled={leaving}
            className="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] text-destructive transition-colors hover:bg-surface-elevated disabled:opacity-60"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
            Leave group
          </button>
        </ModalShell>
      </DialogContent>

      <ConfirmDialog
        open={leaveConfirmOpen}
        onOpenChange={setLeaveConfirmOpen}
        title="Leave group?"
        description="You'll stop receiving messages from this group. An admin can add you back."
        confirmLabel="Leave"
        danger
        onConfirm={handleLeave}
      />
    </Dialog>
  );
}
