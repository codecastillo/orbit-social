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
  Repeat2,
  Reply,
  Newspaper,
  Radio,
  CalendarDays,
  ShoppingBag,
  Users,
  Moon,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePushSubscribe } from "@/lib/hooks/use-push-subscribe";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FormSection, Toggle } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";

type PrefKey =
  | "likes"
  | "comments"
  | "follows"
  | "mentions"
  | "messages"
  | "reposts"
  | "live_streams"
  | "events"
  | "marketplace"
  | "communities"
  | "story_replies"
  | "new_followers_posts";

interface NotificationPref {
  key: PrefKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tileClass: string;
}

const INTERACTION_PREFS: NotificationPref[] = [
  { key: "likes", label: "Likes", description: "When someone likes your post.", icon: Heart, tileClass: "border-primary/20 bg-primary/10 text-primary" },
  { key: "comments", label: "Comments", description: "When someone comments on your post.", icon: MessageCircle, tileClass: "border-primary/20 bg-primary/10 text-primary" },
  { key: "reposts", label: "Reposts and quotes", description: "When someone reposts or quotes your post.", icon: Repeat2, tileClass: "border-primary/20 bg-primary/10 text-primary" },
  { key: "mentions", label: "Mentions", description: "When someone mentions you in a post.", icon: AtSign, tileClass: "border-warning/20 bg-warning/10 text-warning" },
  { key: "story_replies", label: "Story replies", description: "When someone reacts or replies to your story.", icon: Reply, tileClass: "border-warning/20 bg-warning/10 text-warning" },
  { key: "messages", label: "Direct messages", description: "When you receive a new DM.", icon: Mail, tileClass: "border-success/20 bg-success/10 text-success" },
];

const CONTENT_PREFS: NotificationPref[] = [
  { key: "follows", label: "New followers", description: "When someone follows you.", icon: UserPlus, tileClass: "border-primary/20 bg-primary/10 text-primary" },
  { key: "new_followers_posts", label: "Posts from people you follow", description: "New posts from creators you rang the bell for.", icon: Newspaper, tileClass: "border-primary/20 bg-primary/10 text-primary" },
];

const SURFACE_PREFS: NotificationPref[] = [
  { key: "live_streams", label: "Live streams", description: "When someone you follow goes live.", icon: Radio, tileClass: "border-primary/20 bg-primary/10 text-primary" },
  { key: "events", label: "Events", description: "Event invites and reminders.", icon: CalendarDays, tileClass: "border-primary/20 bg-primary/10 text-primary" },
  { key: "marketplace", label: "Marketplace", description: "Activity on your listings and offers.", icon: ShoppingBag, tileClass: "border-primary/20 bg-primary/10 text-primary" },
  { key: "communities", label: "Communities", description: "Room invites and community activity.", icon: Users, tileClass: "border-primary/20 bg-primary/10 text-primary" },
];

const ALL_PREF_KEYS: PrefKey[] = [
  ...INTERACTION_PREFS,
  ...CONTENT_PREFS,
  ...SURFACE_PREFS,
].map((p) => p.key);

const DEFAULTS = Object.fromEntries(
  ALL_PREF_KEYS.map((key) => [key, true]),
) as Record<PrefKey, boolean>;

interface QuietHours {
  enabled: boolean;
  start: number;
  end: number;
}

// 10 PM to 8 AM: the window most people mean by "quiet hours".
const QUIET_DEFAULTS: QuietHours = { enabled: false, start: 22, end: 8 };

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}

export default function NotificationSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>(DEFAULTS);
  const [quiet, setQuiet] = useState<QuietHours>(QUIET_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notification_preferences")
      .select(
        `${ALL_PREF_KEYS.join(", ")}, quiet_hours_enabled, quiet_hours_start, quiet_hours_end`,
      )
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const row = data as unknown as Record<string, boolean | number | null>;
          setPrefs(
            Object.fromEntries(
              ALL_PREF_KEYS.map((key) => [key, (row[key] as boolean | null) ?? true]),
            ) as Record<PrefKey, boolean>,
          );
          setQuiet({
            enabled: (row.quiet_hours_enabled as boolean | null) ?? false,
            start: (row.quiet_hours_start as number | null) ?? QUIET_DEFAULTS.start,
            end: (row.quiet_hours_end as number | null) ?? QUIET_DEFAULTS.end,
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
        quiet_hours_enabled: quiet.enabled,
        quiet_hours_start: quiet.start,
        quiet_hours_end: quiet.end,
        // Hours are stored as local wall-clock; the offset lets the push
        // fanout reconstruct the user's local time from UTC.
        timezone_offset_minutes: new Date().getTimezoneOffset() * -1,
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
      </FormSection>

      <FormSection title="Interactions">
        <PrefRows prefs={prefs} defs={INTERACTION_PREFS} onToggle={togglePref} />
      </FormSection>

      <FormSection title="Content">
        <PrefRows prefs={prefs} defs={CONTENT_PREFS} onToggle={togglePref} />
      </FormSection>

      <FormSection title="Surfaces">
        <PrefRows prefs={prefs} defs={SURFACE_PREFS} onToggle={togglePref} />
      </FormSection>

      <FormSection title="Quiet hours" hint="local time">
        <div className="flex items-center gap-3.5 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <Moon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">Pause push notifications</div>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
              No pushes during this window. Everything still lands in your notifications tab.
            </div>
          </div>
          <Toggle
            on={quiet.enabled}
            onChange={(v) => setQuiet((prev) => ({ ...prev, enabled: v }))}
          />
        </div>
        {quiet.enabled && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border py-3.5">
            <HourSelect
              label="From"
              value={quiet.start}
              onChange={(start) => setQuiet((prev) => ({ ...prev, start }))}
            />
            <HourSelect
              label="Until"
              value={quiet.end}
              onChange={(end) => setQuiet((prev) => ({ ...prev, end }))}
            />
          </div>
        )}
      </FormSection>

      <div className="mt-2 flex justify-end">
        <Button size="lg" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function PrefRows({
  prefs,
  defs,
  onToggle,
}: {
  prefs: Record<PrefKey, boolean>;
  defs: NotificationPref[];
  onToggle: (key: PrefKey) => void;
}) {
  return (
    <div>
      {defs.map((pref, i) => {
        const Icon = pref.icon;
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
            <Toggle on={prefs[pref.key]} onChange={() => onToggle(pref.key)} />
          </div>
        );
      })}
    </div>
  );
}

function HourSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (hour: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 cursor-pointer rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground outline-none focus:border-primary/40"
      >
        {HOURS.map((hour) => (
          <option key={hour} value={hour}>
            {hourLabel(hour)}
          </option>
        ))}
      </select>
    </label>
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
