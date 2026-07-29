"use client";

import { useEffect, useState } from "react";
import {
  Heart,
  MessageCircle,
  UserPlus,
  AtSign,
  Mail,
  Loader2,
  BellRing,
  BellOff,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePushSubscribe } from "@/lib/hooks/use-push-subscribe";
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
    if (error) toast.error("Couldn't save");
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
        <h1 className="mt-1 text-4xl sm:text-5xl font-bold leading-none tracking-[-0.035em] text-foreground">
          What breaks <span className="text-primary">through</span>.
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[14.5px] leading-[1.55] text-muted-foreground">
          Pick the signals you actually want. Everything else stays quiet.
        </p>
      </div>

      <FormSection title="Push notifications">
        <PushDeviceRow />
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

// Device-level opt-in. The toggles above choose WHICH pushes arrive; this row
// is what actually registers the browser with the push service.
function PushDeviceRow() {
  const { status, subscribe, unsubscribe } = usePushSubscribe();
  const [busy, setBusy] = useState(false);

  const handleEnable = async () => {
    setBusy(true);
    const ok = await subscribe();
    setBusy(false);
    if (ok) toast.success("Push enabled on this device");
    else toast.error("Couldn't enable push. Check browser permissions.");
  };

  const handleDisable = async () => {
    setBusy(true);
    const ok = await unsubscribe();
    setBusy(false);
    if (ok) toast.success("Push disabled on this device");
    else toast.error("Couldn't disable push");
  };

  return (
    <div className="mb-4 flex items-center gap-3.5 rounded-xl border border-border bg-surface p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
        {status === "subscribed" ? (
          <BellRing className="h-4 w-4" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">This device</div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">
          {status === "subscribed"
            ? "Push notifications are on for this browser."
            : status === "denied"
              ? "Blocked in your browser settings. Allow notifications for this site to turn them on."
              : status === "unsupported"
                ? "This browser doesn't support push notifications. On iPhone, add Orbit to your home screen first."
                : "Turn on push notifications for this browser."}
        </div>
      </div>
      {status === "subscribed" ? (
        <Button variant="outline" size="sm" onClick={handleDisable} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Turn off"}
        </Button>
      ) : status === "default" || status === "loading" ? (
        <Button size="sm" onClick={handleEnable} disabled={busy || status === "loading"}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Turn on"}
        </Button>
      ) : null}
    </div>
  );
}
