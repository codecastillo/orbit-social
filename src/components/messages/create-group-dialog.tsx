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
import { O, auroraSoft } from "@/lib/design/orbit";

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
        style={{ boxShadow: "none" }}
      >
        <ModalShell
          title="New group"
          subtitle="A conversation between more than two."
          icon={<Users style={{ width: 17, height: 17 }} strokeWidth={1.8} />}
          accent={O.a1}
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
              placeholder="Film photographers — sf trip"
              maxLength={50}
              autoFocus
            />
          </Field>

          <Field
            label="Members"
            hint={`${selectedUsers.length} selected`}
          >
            <div
              style={{
                minHeight: 80,
                padding: 10,
                borderRadius: 12,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${O.hair2}`,
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                alignItems: "flex-start",
              }}
            >
              {selectedUsers.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px 4px 4px",
                    borderRadius: 99,
                    background: auroraSoft,
                    border: `1px solid ${O.a2}44`,
                  }}
                >
                  <UserAvatar
                    src={u.avatar_url}
                    fallback={u.display_name}
                    size="sm"
                  />
                  <span style={{ fontSize: 12, fontWeight: 500, color: O.ink }}>
                    {u.display_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeUser(u.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: O.ink3,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <X style={{ width: 10, height: 10 }} strokeWidth={2} />
                  </button>
                </div>
              ))}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search someone to add…"
                style={{
                  flex: 1,
                  minWidth: 160,
                  padding: "4px 10px",
                  fontSize: 12,
                  color: O.ink,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </Field>

          {searchResults.length > 0 && (
            <>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 11,
                  color: O.ink3,
                  fontFamily: O.mono,
                  letterSpacing: "0.12em",
                  fontWeight: 600,
                }}
              >
                RESULTS
              </div>
              {searchResults.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 10px",
                    borderRadius: 12,
                    cursor: "pointer",
                  }}
                  onClick={() => addUser(p)}
                >
                  <UserAvatar
                    src={p.avatar_url}
                    fallback={p.display_name}
                    size="sm"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: O.ink }}>
                      {p.display_name}
                    </div>
                    <div style={{ fontSize: 11, color: O.ink3 }}>
                      @{p.username}
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${O.hair2}`,
                      color: O.ink2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <Plus style={{ width: 13, height: 13 }} strokeWidth={2} />
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
