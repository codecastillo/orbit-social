"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, Search, X, Loader2, ChevronLeft, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getCloseFriends,
  addCloseFriend,
  removeCloseFriend,
  searchUsers,
  type ProfileSummary,
} from "@/lib/queries/social";
import { cn } from "@/lib/utils";

export default function CloseFriendsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [closeFriends, setCloseFriends] = useState<ProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileSummary[]>([]);
  const [searching, setSearching] = useState(false);

  // Load close friends
  useEffect(() => {
    if (!user) return;
    getCloseFriends(user.id)
      .then(setCloseFriends)
      .catch(() => toast.error("Failed to load close friends"))
      .finally(() => setLoading(false));
  }, [user]);

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
        const closeFriendIds = new Set(closeFriends.map((f) => f.id));
        setSearchResults(
          results.filter(
            (r) => r.id !== user?.id && !closeFriendIds.has(r.id)
          )
        );
      } catch {
        toast.error("Search failed");
      } finally {
        setSearching(false);
      }
    },
    [user?.id, closeFriends]
  );

  const handleAdd = async (profile: ProfileSummary) => {
    if (!user) return;
    try {
      await addCloseFriend(user.id, profile.id);
      setCloseFriends((prev) => [profile, ...prev]);
      setSearchResults((prev) => prev.filter((r) => r.id !== profile.id));
      toast.success(`Added ${profile.display_name} to Close Friends`);
    } catch {
      toast.error("Failed to add close friend");
    }
  };

  const handleRemove = async (friendId: string) => {
    if (!user) return;
    try {
      await removeCloseFriend(user.id, friendId);
      setCloseFriends((prev) => prev.filter((f) => f.id !== friendId));
      toast.success("Removed from Close Friends");
    } catch {
      toast.error("Failed to remove close friend");
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/60 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-5 py-4">
          <button
            onClick={() => router.push("/settings")}
            className="h-9 w-9 rounded-xl bg-white/[0.04] flex items-center justify-center hover:bg-white/[0.08] transition-colors"
          >
            <ChevronLeft className="h-4.5 w-4.5 text-zinc-400" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
              <Users className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            <h1
              className="text-xl font-bold tracking-tight text-zinc-100"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Close Friends
            </h1>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        <p className="text-sm text-zinc-400">
          People in your Close Friends list can see posts you share with the
          Close Friends visibility. Only you can see who is on this list.
        </p>

        {/* Search to add */}
        <div>
          <label className="text-xs font-medium text-zinc-400 mb-1.5 block">
            Add People
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or username..."
              className="w-full h-10 pl-9 pr-3 rounded-lg text-sm bg-white/[0.04] border border-white/[0.1] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 animate-spin" />
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              {searchResults.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center gap-3 p-3 hover:bg-white/[0.04] transition-colors"
                >
                  <UserAvatar
                    src={profile.avatar_url}
                    fallback={profile.display_name}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {profile.display_name}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      @{profile.username}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAdd(profile)}
                    className="rounded-lg px-4 font-semibold bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs"
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current close friends list */}
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-3">
            Your Close Friends ({closeFriends.length})
          </h3>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : closeFriends.length === 0 ? (
            <div className="text-center py-8">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-emerald-400" />
              </div>
              <p className="text-sm text-zinc-400">
                No close friends yet. Search above to add people.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {closeFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors"
                >
                  <UserAvatar
                    src={friend.avatar_url}
                    fallback={friend.display_name}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {friend.display_name}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      @{friend.username}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(friend.id)}
                    className="h-8 w-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove from Close Friends"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
