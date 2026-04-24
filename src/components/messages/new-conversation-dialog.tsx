"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, PenLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
        // Filter out current user
        const filtered = results.filter((r) => r.id !== user?.id);
        setSearchResults(filtered);
      } catch {
        toast.error("Failed to search users");
      } finally {
        setSearching(false);
      }
    },
    [user?.id]
  );

  const handleSelectUser = async (profile: ProfileSummary) => {
    if (!user) {
      toast.error("You must be signed in");
      return;
    }

    setNavigating(profile.id);
    try {
      const conversationId = await getOrCreateDMConversation(
        user.id,
        profile.id
      );
      onOpenChange(false);
      resetForm();
      router.push(`/messages/${conversationId}`);
    } catch {
      toast.error("Failed to start conversation");
    } finally {
      setNavigating(null);
    }
  };

  const resetForm = () => {
    setSearchQuery("");
    setSearchResults([]);
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
            <PenLine className="h-4.5 w-4.5 text-blue-400" />
            New Conversation
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-sm">
            Search for someone to start a conversation with.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-3">
          {/* User search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or username..."
              autoFocus
              className="w-full h-10 pl-9 pr-3 rounded-lg text-sm bg-white/[0.04] border border-white/[0.1] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 animate-spin" />
            )}
          </div>

          {/* Search results */}
          <div className="max-h-[320px] overflow-y-auto">
            {searchResults.length > 0 ? (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                {searchResults.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => handleSelectUser(profile)}
                    disabled={navigating === profile.id}
                    className="flex items-center gap-3 w-full p-3 hover:bg-white/[0.04] transition-colors text-left disabled:opacity-50"
                  >
                    <UserAvatar
                      src={profile.avatar_url}
                      fallback={profile.display_name}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-200 truncate">
                        {profile.display_name}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        @{profile.username}
                      </p>
                    </div>
                    {navigating === profile.id && (
                      <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ) : searchQuery.trim().length >= 2 && !searching ? (
              <p className="text-center text-sm text-zinc-500 py-6">
                No users found
              </p>
            ) : searchQuery.trim().length === 0 ? (
              <p className="text-center text-sm text-zinc-500 py-6">
                Type at least 2 characters to search
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
