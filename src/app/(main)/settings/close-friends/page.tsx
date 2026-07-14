"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Search, Loader2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getCloseFriends,
  addCloseFriend,
  removeCloseFriend,
  searchUsers,
  type ProfileSummary,
} from "@/lib/queries/social";
import { Button } from "@/components/ui/button";
import { FormSection, Input } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";

export default function CloseFriendsPage() {
  const { user } = useAuth();
  const [closeFriends, setCloseFriends] = useState<ProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileSummary[]>([]);
  const [searching, setSearching] = useState(false);

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
          results.filter((r) => r.id !== user?.id && !closeFriendIds.has(r.id))
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
      toast.success(`Added ${profile.display_name}`);
    } catch {
      toast.error("Failed to add");
    }
  };

  const handleRemove = async (friendId: string) => {
    if (!user) return;
    try {
      await removeCloseFriend(user.id, friendId);
      setCloseFriends((prev) => prev.filter((f) => f.id !== friendId));
      toast.success("Removed");
    } catch {
      toast.error("Failed to remove");
    }
  };

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <SettingsHeader section="Close friends" />

      <div>
        <h1 className="mt-1 text-5xl font-bold leading-none tracking-[-0.035em] text-foreground">
          Your <span className="text-primary">inner</span> orbit.
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[14.5px] leading-[1.55] text-muted-foreground">
          A smaller radius. Posts marked &ldquo;close friends&rdquo; only reach this list.
        </p>
      </div>

      <FormSection title="Add people">
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or username…"
          prefix={<Search className="h-3.5 w-3.5" />}
          suffix={
            searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null
          }
        />
        {searchResults.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
            {searchResults.map((profile, i) => (
              <div
                key={profile.id}
                className={`flex items-center gap-3 px-3.5 py-3 ${i ? "border-t border-border" : ""}`}
              >
                <UserAvatar src={profile.avatar_url} fallback={profile.display_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[13.5px] font-semibold text-foreground">
                    {profile.display_name}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    @{profile.username}
                  </p>
                </div>
                <Button size="sm" onClick={() => handleAdd(profile)}>
                  + Add
                </Button>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      <div className="mt-[22px]">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          ◇&nbsp;&nbsp;YOURS · {closeFriends.length}
        </p>
        <div className="mt-3.5 rounded-xl border border-border bg-surface p-2.5">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-[18px] w-[18px] animate-spin text-muted-foreground" />
            </div>
          ) : closeFriends.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-success/20 bg-success/10">
                <Users className="h-5 w-5 text-success" />
              </div>
              <p className="m-0 text-[13px] font-semibold text-text-secondary">
                No close friends yet.
              </p>
              <p className="mt-1 text-xs text-text-faint">
                Search above to add someone.
              </p>
            </div>
          ) : (
            <div>
              {closeFriends.map((friend, i) => (
                <div
                  key={friend.id}
                  className={`flex items-center gap-3 px-3 py-2.5 ${i ? "border-t border-border" : ""}`}
                >
                  <UserAvatar src={friend.avatar_url} fallback={friend.display_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[13.5px] font-semibold text-foreground">
                      {friend.display_name}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      @{friend.username}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(friend.id)}
                    title="Remove"
                    aria-label={`Remove ${friend.display_name}`}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-muted-foreground"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
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
