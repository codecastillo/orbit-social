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
import { Button } from "@/components/ui/button";
import { FormSection, Toggle } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";

type PrefKey = "likes" | "comments" | "follows" | "mentions" | "messages";

interface NotificationPref {
  key: PrefKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tileClass: string;
}

const PREF_DEFS: NotificationPref[] = [
  { key: "likes", label: "Likes", description: "When someone likes your post.", icon: Heart, tileClass: "border-primary/20 bg-primary/10 text-primary" },
  { key: "comments", label: "Comments", description: "When someone comments on your post.", icon: MessageCircle, tileClass: "border-primary/20 bg-primary/10 text-primary" },
  { key: "follows", label: "New followers", description: "When someone follows you.", icon: UserPlus, tileClass: "border-primary/20 bg-primary/10 text-primary" },
  { key: "mentions", label: "Mentions", description: "When someone mentions you in a post.", icon: AtSign, tileClass: "border-warning/20 bg-warning/10 text-warning" },
  { key: "messages", label: "Direct messages", description: "When you receive a new DM.", icon: Mail, tileClass: "border-success/20 bg-success/10 text-success" },
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
      <div className="flex flex-col gap-[18px]">
        <Skeleton className="h-16 w-1/2 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <SettingsHeader section="Notifications" glyph="◈" />

      <div>
        <h1 className="mt-1 text-5xl font-bold leading-none tracking-[-0.035em] text-foreground">
          What breaks <span className="text-primary">through</span>.
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[14.5px] leading-[1.55] text-muted-foreground">
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
                className={`flex items-center gap-3.5 py-3.5 ${i ? "border-t border-border" : ""}`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${pref.tileClass}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{pref.label}</div>
                  <div className="mt-0.5 text-[12.5px] text-muted-foreground">{pref.description}</div>
                </div>
                <Toggle on={enabled} onChange={() => togglePref(pref.key)} />
              </div>
            );
          })}
        </div>
      </FormSection>

      <div className="mt-2 flex justify-end">
        <Button size="lg" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
