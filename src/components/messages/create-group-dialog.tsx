"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Search, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import { searchUsers, type ProfileSummary } from "@/lib/queries/social";
import { createGroupConversation } from "@/lib/queries/messages";
import { cn } from "@/lib/utils";

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
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

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
        // Filter out current user and already selected users
        const filtered = results.filter(
          (r) =>
            r.id !== user?.id &&
            !selectedUsers.some((s) => s.id === r.id)
        );
        setSearchResults(filtered);
      } catch {
        toast.error("Failed to search users");
      } finally {
        setSearching(false);
      }
    },
    [user?.id, selectedUsers]
  );

  const addUser = (profile: ProfileSummary) => {
    setSelectedUsers((prev) => [...prev, profile]);
    setSearchResults((prev) => prev.filter((r) => r.id !== profile.id));
    setSearchQuery("");
  };

  const removeUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleCreate = async () => {
    if (!user || !groupName.trim() || selectedUsers.length === 0) return;

    setCreating(true);
    try {
      const conversationId = await createGroupConversation(
        user.id,
        groupName.trim(),
        selectedUsers.map((u) => u.id)
      );
      toast.success("Group created!");
      onOpenChange(false);
      resetForm();
      router.push(`/messages/${conversationId}`);
    } catch {
      toast.error("Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setGroupName("");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedUsers([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 bg-zinc-900 border-white/[0.1] rounded-xl overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 border-b border-white/[0.06]">
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Users className="h-4.5 w-4.5 text-blue-400" />
            New Group Chat
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-sm">
            Create a group conversation with multiple people.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Group name input */}
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1.5 block">
              Group Name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name..."
              maxLength={50}
              className="w-full h-10 px-3 rounded-lg text-sm bg-white/[0.04] border border-white/[0.1] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          {/* Selected users pills */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20"
                >
                  <UserAvatar
                    src={u.avatar_url}
                    fallback={u.display_name}
                    size="sm"
                  />
                  {u.display_name}
                  <button
                    onClick={() => removeUser(u.id)}
                    className="hover:text-blue-200 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* User search */}
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1.5 block">
              Add Members
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by name or username..."
                className="w-full h-10 pl-9 pr-3 rounded-lg text-sm bg-white/[0.04] border border-white/[0.1] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 animate-spin" />
              )}
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-white/[0.06] bg-white/[0.02]">
                {searchResults.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => addUser(profile)}
                    className="flex items-center gap-3 w-full p-2.5 hover:bg-white/[0.04] transition-colors text-left"
                  >
                    <UserAvatar
                      src={profile.avatar_url}
                      fallback={profile.display_name}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">
                        {profile.display_name}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        @{profile.username}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06] flex justify-end">
          <Button
            onClick={handleCreate}
            disabled={
              !groupName.trim() ||
              selectedUsers.length === 0 ||
              creating
            }
            className="rounded-lg px-6 font-semibold bg-blue-500 hover:bg-blue-600 text-white border-0 transition-colors"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Create Group
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
