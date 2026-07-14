"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Radio,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";
import * as Icons from "lucide-react";
import { Sparkles, ChevronDown } from "lucide-react";
import {
  LIVE_CATEGORIES,
  LIVE_SLOW_MODE_OPTIONS,
  type LiveCategorySlug,
  type LiveLanguageCode,
  type LiveSlowModeSeconds,
} from "@/lib/constants/live-categories";
import {
  LIVE_GAMES_BY_SLUG,
  coverArtSmallUrl,
  type LiveGameSlug,
} from "@/lib/constants/live-games";
import { CategoryPickerDialog } from "@/components/live/category-picker-dialog";
import { TagChipsField } from "@/components/live/tag-chips-field";
import { LanguagePicker } from "@/components/live/language-picker";

const CATEGORY_BY_SLUG: Record<string, (typeof LIVE_CATEGORIES)[number]> =
  Object.fromEntries(LIVE_CATEGORIES.map((c) => [c.slug, c]));

function resolveLucideIcon(name: string) {
  const lookup = Icons as unknown as Record<
    string,
    React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>
  >;
  return lookup[name] ?? Sparkles;
}

interface Credentials {
  streamId: string;
  rtmpsUrl: string;
  srtUrl: string;
  streamKey: string;
  playbackId: string;
  status: "idle" | "live" | "ended";
  title: string | null;
  category: LiveCategorySlug | null;
  gameSlug: LiveGameSlug | null;
  tags: string[];
  language: LiveLanguageCode;
  slowModeSeconds: LiveSlowModeSeconds;
  followersOnlyChat: boolean;
  mature: boolean;
}

export default function StreamingSettingsPage() {
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/live/me", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.detail ?? json.error ?? `http_${res.status}`);
        if (!cancelled) setCreds(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-[22px] text-foreground">
      <div>
        <SettingsHeader section="Streaming" />
        <h1 className="mt-2 text-[44px] font-bold leading-none tracking-[-0.035em] text-foreground">
          Your <span className="text-primary">broadcast</span> credentials.
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[14.5px] leading-[1.55] text-muted-foreground">
          Plug these into OBS, Streamlabs, or your IRL backpack once. Whenever
          you go live, your stream automatically appears in the Live feed.
          You don&apos;t need to do anything on this site. Just hit
          <em> Start Streaming</em> in your software.
        </p>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-border bg-surface p-[18px] text-[13px] text-destructive">
          Failed to load credentials: {error}
        </div>
      )}

      {creds && (
        <>
          {creds.status === "live" && (
            <div className="flex items-center gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              <span className="text-[13px] font-bold tracking-[0.04em] text-destructive">
                You are live right now.
              </span>
              <Link
                href={`/live/${creds.streamId}`}
                className="ml-auto inline-flex items-center gap-1 text-xs text-text-secondary no-underline"
              >
                Open viewer <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}

          <StreamDetailsPanel
            initial={creds}
            onSaved={(patch) => setCreds((prev) => (prev ? { ...prev, ...patch } : prev))}
          />

          <ChatControlsPanel
            initial={creds}
            onSaved={(patch) => setCreds((prev) => (prev ? { ...prev, ...patch } : prev))}
          />

          <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-[22px]">
            <CredField label="OBS · Server URL (RTMPS)" value={creds.rtmpsUrl} />
            <CredField label="OBS · Stream Key" value={creds.streamKey} secret />
            <CredField label="Belabox / SRT (single URL, key embedded)" value={creds.srtUrl} secret />
          </div>

          <SetupGuide />
        </>
      )}
    </div>
  );
}

function StreamDetailsPanel({
  initial,
  onSaved,
}: {
  initial: Credentials;
  onSaved: (patch: Partial<Credentials>) => void;
}) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [category, setCategory] = useState<LiveCategorySlug | "">(initial.category ?? "");
  const [gameSlug, setGameSlug] = useState<LiveGameSlug | null>(initial.gameSlug ?? null);
  const [tags, setTags] = useState<string[]>(initial.tags ?? []);
  const [language, setLanguage] = useState<LiveLanguageCode>(initial.language);
  const [mature, setMature] = useState<boolean>(initial.mature);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = useMemo(() => {
    if (title.trim() !== (initial.title ?? "")) return true;
    if ((category || null) !== (initial.category ?? null)) return true;
    if ((gameSlug ?? null) !== (initial.gameSlug ?? null)) return true;
    if (tags.length !== (initial.tags ?? []).length) return true;
    for (let i = 0; i < tags.length; i++) {
      if (tags[i] !== initial.tags[i]) return true;
    }
    if (language !== initial.language) return true;
    if (mature !== initial.mature) return true;
    return false;
  }, [title, category, gameSlug, tags, language, mature, initial]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const onSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    const trimmedTitle = title.trim();
    const body: Record<string, unknown> = {};
    if (trimmedTitle !== (initial.title ?? "")) {
      if (!trimmedTitle) {
        toast.error("Title can't be empty");
        setSaving(false);
        return;
      }
      body.title = trimmedTitle;
    }
    if ((category || null) !== (initial.category ?? null)) {
      body.category = category || null;
    }
    if ((gameSlug ?? null) !== (initial.gameSlug ?? null)) {
      body.game_slug = gameSlug;
    }
    if (
      tags.length !== (initial.tags ?? []).length ||
      tags.some((t, i) => t !== initial.tags[i])
    ) {
      body.tags = tags;
    }
    if (language !== initial.language) body.language = language;
    if (mature !== initial.mature) body.mature = mature;

    try {
      const res = await fetch("/api/live/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.detail ?? json.error ?? `http_${res.status}`);
      }
      onSaved({
        title: trimmedTitle || null,
        category: (category || null) as LiveCategorySlug | null,
        gameSlug: gameSlug,
        tags: [...tags],
        language,
        mature,
      });
      setSavedFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setSavedFlash(false), 2000);
    } catch {
      toast.error("Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-[18px] rounded-xl border border-border bg-surface p-[22px]">
      <div>
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          ◆&nbsp;&nbsp;STREAM DETAILS
        </p>
        <div className="mt-1.5 text-base font-semibold tracking-[-0.01em] text-foreground">
          What viewers see when you go live
        </div>
      </div>

      <FieldLabel label="Title" hint={`${title.length}/100`}>
        <BareInput
          value={title}
          maxLength={100}
          placeholder="e.g. Building a Twitch clone live"
          onChange={(e) => setTitle(e.target.value)}
        />
      </FieldLabel>

      <FieldLabel label="Category">
        <CategoryPickerButton
          category={category || null}
          gameSlug={gameSlug}
          onClick={() => setPickerOpen(true)}
        />
      </FieldLabel>

      <FieldLabel
        label="Tags"
        hint={`${tags.length}/5 · lowercase, letters/numbers/hyphen only`}
      >
        <TagChipsField
          tags={tags}
          onChange={setTags}
          max={5}
          placeholder="Add a tag, press Enter"
          suggestions={["chill", "firstplaythrough", "controller", "1080p60"]}
        />
      </FieldLabel>

      <FieldLabel label="Language">
        <LanguagePicker value={language} onChange={setLanguage} />
      </FieldLabel>

      <CategoryPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        value={{ category: category || null, gameSlug }}
        onSave={(next) => {
          setCategory((next.category ?? "") as LiveCategorySlug | "");
          setGameSlug(next.gameSlug as LiveGameSlug | null);
        }}
      />

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated px-3.5 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-foreground">
            Mature content
          </span>
          <span className="text-[11.5px] leading-[1.4] text-muted-foreground">
            Stream may contain mature themes (language, violence, suggestive content).
          </span>
        </div>
        <Toggle on={mature} onChange={setMature} />
      </div>

      <div className="mt-1 flex items-center justify-end gap-2.5">
        {savedFlash && (
          <span className="inline-flex items-center gap-1 font-mono text-xs tracking-[0.04em] text-success">
            <Check className="h-3 w-3" /> Saved
          </span>
        )}
        <Button onClick={onSave} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save details"}
        </Button>
      </div>
    </div>
  );
}

function ChatControlsPanel({
  initial,
  onSaved,
}: {
  initial: Credentials;
  onSaved: (patch: Partial<Credentials>) => void;
}) {
  const [slowMode, setSlowMode] = useState<LiveSlowModeSeconds>(initial.slowModeSeconds);
  const [followersOnly, setFollowersOnly] = useState<boolean>(initial.followersOnlyChat);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialRef = useRef({
    slowMode: initial.slowModeSeconds,
    followersOnly: initial.followersOnlyChat,
  });

  useEffect(() => {
    initialRef.current = {
      slowMode: initial.slowModeSeconds,
      followersOnly: initial.followersOnlyChat,
    };
  }, [initial.slowModeSeconds, initial.followersOnlyChat]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const persist = (next: { slowMode: LiveSlowModeSeconds; followersOnly: boolean }) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      const body: Record<string, unknown> = {};
      if (next.slowMode !== initialRef.current.slowMode) {
        body.slow_mode_seconds = next.slowMode;
      }
      if (next.followersOnly !== initialRef.current.followersOnly) {
        body.followers_only_chat = next.followersOnly;
      }
      if (Object.keys(body).length === 0) return;
      try {
        const res = await fetch("/api/live/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.detail ?? json.error ?? `http_${res.status}`);
        }
        onSaved({
          slowModeSeconds: next.slowMode,
          followersOnlyChat: next.followersOnly,
        });
        setSavedFlash(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setSavedFlash(false), 2000);
      } catch {
        toast.error("Couldn't save");
      }
    }, 350);
  };

  const onSlowModeChange = (v: LiveSlowModeSeconds) => {
    setSlowMode(v);
    persist({ slowMode: v, followersOnly });
  };

  const onFollowersOnlyChange = (v: boolean) => {
    setFollowersOnly(v);
    persist({ slowMode, followersOnly: v });
  };

  return (
    <div className="flex flex-col gap-[18px] rounded-xl border border-border bg-surface p-[22px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            ◆&nbsp;&nbsp;CHAT CONTROLS
          </p>
          <div className="mt-1.5 text-base font-semibold tracking-[-0.01em] text-foreground">
            Keep your chat civil
          </div>
        </div>
        {savedFlash && (
          <span className="inline-flex items-center gap-1 font-mono text-xs tracking-[0.04em] text-success">
            <Check className="h-3 w-3" /> Saved
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-[-0.005em] text-foreground">
          Slow mode
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LIVE_SLOW_MODE_OPTIONS.map((opt) => {
            const active = slowMode === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onSlowModeChange(opt)}
                className={`cursor-pointer rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-surface-elevated text-text-secondary"
                }`}
              >
                {opt === 0 ? "Off" : `${opt}s`}
              </button>
            );
          })}
        </div>
        <div className="text-[11.5px] leading-[1.4] text-muted-foreground">
          {slowMode === 0
            ? "Anyone can chat as fast as they want."
            : `Viewers must wait ${slowMode}s between messages.`}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated px-3.5 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-foreground">
            Followers-only chat
          </span>
          <span className="text-[11.5px] leading-[1.4] text-muted-foreground">
            Only people who follow you can send messages.
          </span>
        </div>
        <Toggle on={followersOnly} onChange={onFollowersOnlyChange} />
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-semibold tracking-[-0.005em] text-foreground">
          {label}
        </label>
        {hint && (
          <span className="font-mono text-[11px] tracking-[0.02em] text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function BareInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-border bg-surface-elevated px-3.5 py-[11px] text-sm text-foreground outline-none"
    />
  );
}

function CategoryPickerButton({
  category,
  gameSlug,
  onClick,
}: {
  category: string | null;
  gameSlug: LiveGameSlug | null;
  onClick: () => void;
}) {
  const game = gameSlug ? LIVE_GAMES_BY_SLUG[gameSlug] : null;
  const cat = category ? CATEGORY_BY_SLUG[category] : null;

  let inner: React.ReactNode;
  if (game) {
    inner = (
      <>
        <img
          src={coverArtSmallUrl(game.slug)}
          alt={game.label}
          width={26}
          height={34}
          className="rounded object-cover"
          // Per-game accent hue comes from data, so it stays inline.
          style={{ background: `oklch(0.4 0.18 ${game.accentHue})` }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="min-w-0 text-left">
          <div className="text-[13px] font-bold leading-[1.2] text-foreground">
            {game.label}
          </div>
          <div className="mt-px text-[11px] text-muted-foreground">in Gaming</div>
        </div>
      </>
    );
  } else if (cat) {
    const Icon = resolveLucideIcon(cat.iconName);
    inner = (
      <>
        <span
          className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-lg"
          // Per-category hue comes from data, so it stays inline.
          style={{
            background: `oklch(0.55 0.18 ${cat.hue} / 0.18)`,
            color: `oklch(0.85 0.16 ${cat.hue})`,
          }}
        >
          <Icon size={14} />
        </span>
        <span className="text-[13px] font-bold text-foreground">{cat.label}</span>
      </>
    );
  } else {
    inner = (
      <>
        <Sparkles size={14} className="text-muted-foreground" />
        <span className="text-[13px] text-muted-foreground">Pick a category</span>
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-surface-elevated py-2 pl-2.5 pr-3 text-left transition-colors hover:border-primary/40 hover:bg-surface"
    >
      {inner}
      <ChevronDown size={14} className="ml-auto text-muted-foreground" />
    </button>
  );
}

function CredField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [revealed, setRevealed] = useState(!secret);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };
  const display = revealed ? value : "•".repeat(Math.min(value.length, 40));
  return (
    <div>
      <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-2.5 font-mono text-[12.5px]">
        <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-foreground">
          {display}
        </code>
        {secret && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="cursor-pointer rounded-md border-none bg-transparent p-1 text-muted-foreground"
            aria-label={revealed ? "Hide" : "Reveal"}
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="cursor-pointer rounded-md border-none bg-transparent p-1 text-text-secondary"
          aria-label="Copy"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function SetupGuide() {
  return (
    <div className="rounded-xl border border-border bg-surface p-[22px]">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        ◆&nbsp;&nbsp;SETUP GUIDE
      </p>

      <Section title="OBS Studio (desktop)">
        <Step n={1}>
          Open OBS &rarr; <strong>Settings</strong> &rarr; <strong>Stream</strong>.
        </Step>
        <Step n={2}>
          Service: <code className={CODE_CLASS}>Custom...</code>
        </Step>
        <Step n={3}>Server: paste the RTMPS URL above.</Step>
        <Step n={4}>Stream Key: paste your Stream Key above.</Step>
        <Step n={5}>
          Click <strong>OK</strong>, then <strong>Start Streaming</strong> in
          the main window. You go live automatically.
        </Step>
      </Section>

      <Section title="Belabox / IRL Toolkit (cellular)">
        <Step n={1}>
          In your Belabox Cloud / IRLToolkit dashboard, set the destination URL
          to the SRT URL above (it includes your stream key).
        </Step>
        <Step n={2}>Start the encoder. Mux ingest accepts SRT-bonded streams.</Step>
      </Section>

      <Section title="Mobile (iOS/Android)">
        <Step n={1}>
          Install <strong>Larix Broadcaster</strong> (free, RTMPS support).
        </Step>
        <Step n={2}>Add a new connection &rarr; URL: paste the RTMPS URL.</Step>
        <Step n={3}>Stream key: paste your Stream Key. Save.</Step>
        <Step n={4}>Tap the broadcast button. Live within ~5s.</Step>
      </Section>

      <p className="mt-3 text-xs italic leading-normal text-muted-foreground">
        Your stream key never expires. Don&apos;t share it. Anyone with it
        can broadcast as you. If it leaks, contact support to rotate.
      </p>
    </div>
  );
}

const CODE_CLASS =
  "rounded border border-border bg-surface-elevated px-1.5 py-px font-mono text-[11px]";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-foreground">
        <Radio className="h-3.5 w-3.5 text-destructive" />
        {title}
      </div>
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
        {children}
      </ol>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[13px] leading-normal text-text-secondary">
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-surface-elevated font-mono text-[11px] text-muted-foreground">
        {n}
      </span>
      <span className="pt-px">{children}</span>
    </li>
  );
}
