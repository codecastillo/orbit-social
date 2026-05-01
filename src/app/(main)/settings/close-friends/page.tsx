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
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
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
    <div style={{ color: O.ink, fontFamily: O.sans, display: "flex", flexDirection: "column", gap: 18 }}>
      <SettingsHeader section="Close friends" />

      <div>
        <Display size={48} style={{ marginTop: 4 }}>
          Your <Acc>inner</Acc> orbit.
        </Display>
        <p style={{ fontSize: 14.5, color: O.ink3, marginTop: 10, lineHeight: 1.55, maxWidth: 560 }}>
          A smaller radius. Posts marked &ldquo;close friends&rdquo; only reach this list.
        </p>
      </div>

      <FormSection title="Add people">
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or username…"
          prefix={<Search style={{ width: 14, height: 14 }} />}
          suffix={
            searching ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : null
          }
        />
        {searchResults.length > 0 && (
          <div
            style={{
              marginTop: 12,
              borderRadius: 14,
              border: `1px solid ${O.hair}`,
              background: "rgba(255,255,255,0.02)",
              overflow: "hidden",
            }}
          >
            {searchResults.map((profile, i) => (
              <div
                key={profile.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderTop: i ? `1px solid ${O.hair}` : "none",
                }}
              >
                <UserAvatar src={profile.avatar_url} fallback={profile.display_name} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0, color: O.ink }}>
                    {profile.display_name}
                  </p>
                  <p style={{ fontSize: 11.5, color: O.ink3, margin: "2px 0 0" }}>
                    @{profile.username}
                  </p>
                </div>
                <PillBtn primary size="sm" onClick={() => handleAdd(profile)}>
                  + Add
                </PillBtn>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      <div style={{ marginTop: 22 }}>
        <Eyebrow>◇&nbsp;&nbsp;YOURS · {closeFriends.length}</Eyebrow>
        <div
          style={{
            ...panel({ borderRadius: 18 }),
            padding: 10,
            marginTop: 14,
          }}
        >
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
              <Loader2 style={{ width: 18, height: 18, color: O.ink3 }} className="animate-spin" />
            </div>
          ) : closeFriends.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 16px", color: O.ink3 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  margin: "0 auto 12px",
                  borderRadius: 12,
                  background: "rgba(125,255,163,0.08)",
                  border: "1px solid rgba(125,255,163,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Users style={{ width: 20, height: 20, color: "#7dffa3" }} />
              </div>
              <p style={{ fontSize: 13, margin: 0, color: O.ink2, fontWeight: 600 }}>
                No close friends yet.
              </p>
              <p style={{ fontSize: 12, margin: "4px 0 0", color: O.ink4 }}>
                Search above to add someone.
              </p>
            </div>
          ) : (
            <div>
              {closeFriends.map((friend, i) => (
                <div
                  key={friend.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderTop: i ? `1px solid ${O.hair}` : "none",
                  }}
                >
                  <UserAvatar src={friend.avatar_url} fallback={friend.display_name} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0, color: O.ink }}>
                      {friend.display_name}
                    </p>
                    <p style={{ fontSize: 11.5, color: O.ink3, margin: "2px 0 0" }}>
                      @{friend.username}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(friend.id)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      border: "none",
                      background: "transparent",
                      color: O.ink3,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="Remove"
                  >
                    <UserMinus style={{ width: 14, height: 14 }} />
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
