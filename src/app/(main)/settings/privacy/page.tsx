"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FormSection, Toggle } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";

export default function PrivacySettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [isPrivate, setIsPrivate] = useState(false);
  const [hideActivity, setHideActivity] = useState(false);
  const [privateFollowers, setPrivateFollowers] = useState(false);
  const [privateLikes, setPrivateLikes] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
  }, [user, supabase]);

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
    if (error) toast.error("Failed to update privacy settings");
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

  const ToggleRow = ({
    label,
    hint,
    on,
    onChange,
  }: {
    label: string;
    hint: string;
    on: boolean;
    onChange: (v: boolean) => void;
  }) => (
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

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <SettingsHeader section="Privacy" glyph="◆" />

      <div>
        <h1 className="mt-1 text-[48px] font-bold leading-none tracking-[-0.035em]">
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
            label="Hide your Likes tab"
            hint="People won't see what you've liked. You can still see it on your own profile."
            on={privateLikes}
            onChange={setPrivateLikes}
          />
        </div>
      </FormSection>

      <div className="mt-2 flex justify-end gap-2.5">
        <Button size="lg" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
