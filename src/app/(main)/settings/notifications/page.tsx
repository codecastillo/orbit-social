"use client";

import { useEffect, useState } from "react";
import {
  Heart,
  MessageCircle,
  UserPlus,
  AtSign,
  Mail,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { O } from "@/lib/design/orbit";
import { Display, Acc, PillBtn } from "@/components/orbit/primitives";
import { FormSection, Toggle } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";

type PrefKey = "likes" | "comments" | "follows" | "mentions" | "messages";

interface NotificationPref {
  key: PrefKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  hue: string;
}

const PREF_DEFS: NotificationPref[] = [
  { key: "likes", label: "Likes", description: "When someone likes your post.", icon: Heart, hue: O.a2 },
  { key: "comments", label: "Comments", description: "When someone comments on your post.", icon: MessageCircle, hue: O.a3 },
  { key: "follows", label: "New followers", description: "When someone follows you.", icon: UserPlus, hue: O.a1 },
  { key: "mentions", label: "Mentions", description: "When someone mentions you in a post.", icon: AtSign, hue: "#ffd76a" },
  { key: "messages", label: "Direct messages", description: "When you receive a new DM.", icon: Mail, hue: "#7dffa3" },
];

const DEFAULTS: Record<PrefKey, boolean> = {
  likes: true,
  comments: true,
  follows: true,
  mentions: true,
  messages: true,
};

export default function NotificationSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notification_preferences")
      .select("likes, comments, follows, mentions, messages")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrefs({
            likes: data.likes ?? true,
            comments: data.comments ?? true,
            follows: data.follows ?? true,
            mentions: data.mentions ?? true,
            messages: data.messages ?? true,
          });
        }
        setLoading(false);
      });
  }, [user, supabase]);

  const togglePref = (key: PrefKey) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({
        user_id: user.id,
        ...prefs,
        updated_at: new Date().toISOString(),
      });
    if (error) toast.error("Failed to save");
    else toast.success("Saved");
    setSaving(false);
  };

  if (authLoading || loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Skeleton className="h-16 w-1/2 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div style={{ color: O.ink, fontFamily: O.sans, display: "flex", flexDirection: "column", gap: 18 }}>
      <SettingsHeader section="Notifications" glyph="◈" />

      <div>
        <Display size={48} style={{ marginTop: 4 }}>
          What breaks <Acc>through</Acc>.
        </Display>
        <p style={{ fontSize: 14.5, color: O.ink3, marginTop: 10, lineHeight: 1.55, maxWidth: 560 }}>
          Pick the signals you actually want. Everything else stays quiet.
        </p>
      </div>

      <FormSection title="Push notifications">
        <div>
          {PREF_DEFS.map((pref, i) => {
            const Icon = pref.icon;
            const enabled = prefs[pref.key];
            return (
              <div
                key={pref.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 0",
                  borderTop: i ? `1px solid ${O.hair}` : "none",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: `${pref.hue}1a`,
                    border: `1px solid ${pref.hue}33`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon style={{ width: 16, height: 16, color: pref.hue }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: O.ink }}>{pref.label}</div>
                  <div style={{ fontSize: 12.5, color: O.ink3, marginTop: 2 }}>{pref.description}</div>
                </div>
                <Toggle on={enabled} onChange={() => togglePref(pref.key)} />
              </div>
            );
          })}
        </div>
      </FormSection>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <PillBtn primary size="lg" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : "Save changes"}
        </PillBtn>
      </div>
    </div>
  );
}
