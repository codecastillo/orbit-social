"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { O } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { FormSection, Toggle } from "@/components/orbit/forms";

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
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "14px 0",
        borderTop: `1px solid ${O.hair}`,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: O.ink }}>{label}</div>
        <div style={{ fontSize: 12.5, color: O.ink3, marginTop: 4, lineHeight: 1.45 }}>
          {hint}
        </div>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );

  return (
    <div style={{ color: O.ink, fontFamily: O.sans, display: "flex", flexDirection: "column", gap: 18 }}>
      <Link
        href="/settings"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: O.ink3,
          fontFamily: O.mono,
          fontSize: 11,
          letterSpacing: "0.12em",
          textDecoration: "none",
          width: "fit-content",
        }}
      >
        <ArrowLeft style={{ width: 12, height: 12 }} />
        BACK · SETTINGS
      </Link>

      <div>
        <Eyebrow accent>◆&nbsp;&nbsp;SETTINGS · PRIVACY</Eyebrow>
        <Display size={48} style={{ marginTop: 8 }}>
          Kept <Acc>quiet</Acc>.
        </Display>
        <p style={{ fontSize: 14.5, color: O.ink3, marginTop: 10, lineHeight: 1.55, maxWidth: 560 }}>
          Who can see what, and when. Your radius, your rules.
        </p>
      </div>

      <FormSection title="Visibility">
        <div style={{ paddingTop: 4 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              paddingBottom: 14,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: O.ink }}>Private account</div>
              <div style={{ fontSize: 12.5, color: O.ink3, marginTop: 4, lineHeight: 1.45 }}>
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

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 8,
        }}
      >
        <PillBtn primary size="lg" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : "Save changes"}
        </PillBtn>
      </div>
    </div>
  );
}
