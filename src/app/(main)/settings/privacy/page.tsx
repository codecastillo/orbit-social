"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FormSection, Toggle } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  getBlockedUsers,
  getMutedUsers,
  unblockUser,
  unmuteUser,
  type ProfileSummary,
} from "@/lib/queries/social";
import {
  getRestrictedProfiles,
  unrestrictUser,
} from "@/lib/queries/content-safety";
import {
  getReadReceiptsEnabled,
  setReadReceiptsEnabled,
} from "@/lib/queries/messages";

function AccountRow({
  profile,
  divider,
  actionLabel,
  onAction,
}: {
  profile: ProfileSummary;
  divider: boolean;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 py-3 ${divider ? "border-t border-border" : ""}`}
    >
      <UserAvatar
        src={profile.avatar_url}
        fallback={profile.display_name || profile.username}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-sm font-semibold text-foreground">
          {profile.display_name || profile.username}
        </p>
        <p className="m-0 truncate font-mono text-[11.5px] text-muted-foreground">
          @{profile.username}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-[18px] border-t border-border py-3.5">
      <div className="flex-1">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        <div className="mt-1 text-[12.5px] leading-[1.45] text-muted-foreground">
          {hint}
        </div>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

export default function PrivacySettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [isPrivate, setIsPrivate] = useState(false);
  const [hideActivity, setHideActivity] = useState(false);
  const [privateFollowers, setPrivateFollowers] = useState(false);
  const [privateLikes, setPrivateLikes] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState<ProfileSummary[]>([]);
  const [muted, setMuted] = useState<ProfileSummary[]>([]);
  const [restricted, setRestricted] = useState<ProfileSummary[]>([]);
  const [listsLoading, setListsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("is_private, hide_activity, private_followers, private_likes")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setIsPrivate(data.is_private ?? false);
          setHideActivity(data.hide_activity ?? false);
          setPrivateFollowers(data.private_followers ?? false);
          setPrivateLikes(data.private_likes ?? false);
        }
        setProfileLoading(false);
      });
    // Separate read: getReadReceiptsEnabled degrades to true until the
    // read_receipts_enabled migration lands, without failing the main select.
    getReadReceiptsEnabled(user.id).then(setReadReceipts);
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getBlockedUsers(user.id),
      getMutedUsers(user.id),
      getRestrictedProfiles(user.id),
    ])
      .then(([blockedUsers, mutedUsers, restrictedUsers]) => {
        setBlocked(blockedUsers);
        setMuted(mutedUsers);
        setRestricted(restrictedUsers);
      })
      .catch(() => toast.error("Couldn't load blocked and muted accounts"))
      .finally(() => setListsLoading(false));
  }, [user]);

  const handleUnblock = async (profile: ProfileSummary) => {
    if (!user) return;
    setBlocked((prev) => prev.filter((p) => p.id !== profile.id));
    try {
      await unblockUser(user.id, profile.id);
      // Profiles and DM composers read this cache for enforcement.
      queryClient.invalidateQueries({ queryKey: ["blocked-ids", user.id] });
      toast.success(`Unblocked @${profile.username}`);
    } catch {
      setBlocked((prev) => [profile, ...prev]);
      toast.error(`Couldn't unblock @${profile.username}`);
    }
  };

  const handleUnmute = async (profile: ProfileSummary) => {
    if (!user) return;
    setMuted((prev) => prev.filter((p) => p.id !== profile.id));
    try {
      await unmuteUser(user.id, profile.id);
      // The feed and clip filters read this cache for enforcement.
      queryClient.invalidateQueries({ queryKey: ["muted-ids", user.id] });
      toast.success(`Unmuted @${profile.username}`);
    } catch {
      setMuted((prev) => [profile, ...prev]);
      toast.error(`Couldn't unmute @${profile.username}`);
    }
  };

  const handleUnrestrict = async (profile: ProfileSummary) => {
    if (!user) return;
    setRestricted((prev) => prev.filter((p) => p.id !== profile.id));
    try {
      await unrestrictUser(user.id, profile.id);
      // Comment lists and read receipts read this cache for enforcement.
      queryClient.invalidateQueries({ queryKey: ["restricted-users", user.id] });
      toast.success(`Unrestricted @${profile.username}`);
    } catch {
      setRestricted((prev) => [profile, ...prev]);
      toast.error(`Couldn't unrestrict @${profile.username}`);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        is_private: isPrivate,
        hide_activity: hideActivity,
        private_followers: privateFollowers,
        private_likes: privateLikes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    let receiptsError = false;
    try {
      await setReadReceiptsEnabled(user.id, readReceipts);
    } catch {
      receiptsError = true;
    }
    if (error || receiptsError) toast.error("Couldn't update privacy settings");
    else toast.success("Saved");
    setSaving(false);
  };

  if (authLoading || profileLoading) {
    return (
      <div className="flex flex-col gap-[18px]">
        <Skeleton className="h-16 w-1/2 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <SettingsHeader section="Privacy" glyph="◆" />

      <div>
        <h1 className="mt-1 text-4xl sm:text-[48px] font-bold leading-none tracking-[-0.035em]">
          Kept <span className="text-primary">quiet</span>.
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[14.5px] leading-[1.55] text-muted-foreground">
          Who can see what, and when. Your radius, your rules.
        </p>
      </div>

      <FormSection title="Visibility">
        <div className="pt-1">
          <div className="flex items-center gap-[18px] pb-3.5">
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Private account</div>
              <div className="mt-1 text-[12.5px] leading-[1.45] text-muted-foreground">
                Only approved followers can see your posts. Your profile card stays visible.
              </div>
            </div>
            <Toggle on={isPrivate} onChange={setIsPrivate} />
          </div>
          <ToggleRow
            label="Hide activity status"
            hint="Don't show when you were last online or typing."
            on={hideActivity}
            onChange={setHideActivity}
          />
          <ToggleRow
            label="Hide your followers and following"
            hint="The counts stay public, but the lists won't open for anyone but you."
            on={privateFollowers}
            onChange={setPrivateFollowers}
          />
          <ToggleRow
            label="Read receipts"
            hint="Show people when you've seen their messages. Turn it off and you won't see theirs either."
            on={readReceipts}
            onChange={setReadReceipts}
          />
          <ToggleRow
            label="Hide your Likes tab"
            hint="People won't see what you've liked. You can still see it on your own profile."
            on={privateLikes}
            onChange={setPrivateLikes}
          />
        </div>
      </FormSection>

      <FormSection title="Blocked accounts">
        {listsLoading ? (
          <Skeleton className="h-14 w-full rounded-xl" />
        ) : blocked.length === 0 ? (
          <p className="m-0 py-2 text-[12.5px] text-muted-foreground">
            You haven&apos;t blocked anyone.
          </p>
        ) : (
          <div>
            {blocked.map((profile, index) => (
              <AccountRow
                key={profile.id}
                profile={profile}
                divider={index > 0}
                actionLabel="Unblock"
                onAction={() => handleUnblock(profile)}
              />
            ))}
          </div>
        )}
      </FormSection>

      <FormSection title="Muted accounts">
        {listsLoading ? (
          <Skeleton className="h-14 w-full rounded-xl" />
        ) : muted.length === 0 ? (
          <p className="m-0 py-2 text-[12.5px] text-muted-foreground">
            You haven&apos;t muted anyone.
          </p>
        ) : (
          <div>
            {muted.map((profile, index) => (
              <AccountRow
                key={profile.id}
                profile={profile}
                divider={index > 0}
                actionLabel="Unmute"
                onAction={() => handleUnmute(profile)}
              />
            ))}
          </div>
        )}
      </FormSection>

      <FormSection
        title="Restricted accounts"
        hint="Their comments and read receipts stay hidden from you"
      >
        {listsLoading ? (
          <Skeleton className="h-14 w-full rounded-xl" />
        ) : restricted.length === 0 ? (
          <p className="m-0 py-2 text-[12.5px] text-muted-foreground">
            You haven&apos;t restricted anyone. Restrict someone from their
            profile menu.
          </p>
        ) : (
          <div>
            {restricted.map((profile, index) => (
              <AccountRow
                key={profile.id}
                profile={profile}
                divider={index > 0}
                actionLabel="Unrestrict"
                onAction={() => handleUnrestrict(profile)}
              />
            ))}
          </div>
        )}
      </FormSection>

      <div className="mt-2 flex justify-end gap-2.5">
        <Button size="lg" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
