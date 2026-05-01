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
  X as XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { O, panel, aurora } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow } from "@/components/orbit/primitives";
import { Toggle } from "@/components/orbit/forms";
import { SettingsHeader } from "@/components/settings/settings-header";
import * as Icons from "lucide-react";
import { Sparkles, ChevronDown, Pencil } from "lucide-react";
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
    <div
      style={{
        color: O.ink,
        fontFamily: O.sans,
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      <div>
        <SettingsHeader section="Streaming" />
        <div style={{ marginTop: -2 }} />
        <Display size={44} style={{ marginTop: 8 }}>
          Your <Acc>broadcast</Acc> credentials.
        </Display>
        <p
          style={{
            fontSize: 14.5,
            color: O.ink3,
            marginTop: 10,
            lineHeight: 1.55,
            maxWidth: 560,
          }}
        >
          Plug these into OBS, Streamlabs, or your IRL backpack once. Whenever
          you go live, your stream automatically appears in the Live feed.
          You don&apos;t need to do anything on this site. Just hit
          <em> Start Streaming</em> in your software.
        </p>
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      )}

      {error && (
        <div
          style={{
            ...panel(),
            padding: 18,
            color: "#ff8a8a",
            fontSize: 13,
          }}
        >
          Failed to load credentials: {error}
        </div>
      )}

      {creds && (
        <>
          {creds.status === "live" && (
            <div
              style={{
                ...panel(),
                padding: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderColor: "rgba(255,90,106,0.4)",
                background: "rgba(255,90,106,0.08)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#ff5a6a",
                  boxShadow: "0 0 12px #ff5a6a",
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#ff5a6a",
                  letterSpacing: "0.04em",
                }}
              >
                You are live right now.
              </span>
              <Link
                href={`/live/${creds.streamId}`}
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: O.ink2,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  textDecoration: "none",
                }}
              >
                Open viewer <ExternalLink style={{ width: 12, height: 12 }} />
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

          <div style={{ ...panel(), padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
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
    <div style={{ ...panel(), padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <Eyebrow>◆&nbsp;&nbsp;STREAM DETAILS</Eyebrow>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: O.ink,
            marginTop: 6,
            letterSpacing: "-0.01em",
          }}
        >
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.025)",
          border: `1px solid ${O.hair2}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: O.ink }}>
            Mature content
          </span>
          <span style={{ fontSize: 11.5, color: O.ink3, lineHeight: 1.4 }}>
            Stream may contain mature themes (language, violence, suggestive content).
          </span>
        </div>
        <Toggle on={mature} onChange={setMature} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 4,
        }}
      >
        {savedFlash && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              color: "#5fd4ff",
              fontFamily: O.mono,
              letterSpacing: "0.04em",
            }}
          >
            <Check style={{ width: 12, height: 12 }} /> Saved
          </span>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          style={{
            padding: "10px 20px",
            borderRadius: 99,
            border: "none",
            background: dirty && !saving ? aurora : "rgba(255,255,255,0.06)",
            color: dirty && !saving ? "white" : O.ink3,
            fontSize: 13,
            fontWeight: 600,
            cursor: dirty && !saving ? "pointer" : "not-allowed",
            boxShadow:
              dirty && !saving
                ? `0 8px 24px -6px ${O.a1}80, inset 0 1px 0 rgba(255,255,255,0.25)`
                : "none",
            fontFamily: "inherit",
            letterSpacing: "-0.005em",
          }}
        >
          {saving ? "Saving…" : "Save details"}
        </button>
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
    <div style={{ ...panel(), padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <Eyebrow>◆&nbsp;&nbsp;CHAT CONTROLS</Eyebrow>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: O.ink,
              marginTop: 6,
              letterSpacing: "-0.01em",
            }}
          >
            Keep your chat civil
          </div>
        </div>
        {savedFlash && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              color: "#5fd4ff",
              fontFamily: O.mono,
              letterSpacing: "0.04em",
            }}
          >
            <Check style={{ width: 12, height: 12 }} /> Saved
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: O.ink,
            letterSpacing: "-0.005em",
          }}
        >
          Slow mode
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {LIVE_SLOW_MODE_OPTIONS.map((opt) => {
            const active = slowMode === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onSlowModeChange(opt)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 99,
                  background: active ? `${O.a3}1f` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? `${O.a3}66` : O.hair2}`,
                  color: active ? "#5fd4ff" : O.ink2,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: active ? `0 0 0 3px ${O.a3}14` : "none",
                  transition: "all 0.15s",
                }}
              >
                {opt === 0 ? "Off" : `${opt}s`}
              </button>
            );
          })}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: O.ink3,
            lineHeight: 1.4,
          }}
        >
          {slowMode === 0
            ? "Anyone can chat as fast as they want."
            : `Viewers must wait ${slowMode}s between messages.`}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.025)",
          border: `1px solid ${O.hair2}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: O.ink }}>
            Followers-only chat
          </span>
          <span style={{ fontSize: 11.5, color: O.ink3, lineHeight: 1.4 }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: O.ink,
            letterSpacing: "-0.005em",
          }}
        >
          {label}
        </label>
        {hint && (
          <span
            style={{
              fontSize: 11,
              color: O.ink3,
              fontFamily: O.mono,
              letterSpacing: "0.02em",
            }}
          >
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
      style={{
        padding: "11px 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${O.hair2}`,
        color: O.ink,
        fontSize: 14,
        outline: "none",
        fontFamily: "inherit",
        width: "100%",
        ...(props.style ?? {}),
      }}
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
          style={{
            borderRadius: 4,
            objectFit: "cover",
            background: `oklch(0.4 0.18 ${game.accentHue})`,
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <div style={{ minWidth: 0, textAlign: "left" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: O.ink, lineHeight: 1.2 }}>
            {game.label}
          </div>
          <div style={{ fontSize: 11, color: O.ink3, marginTop: 1 }}>in Gaming</div>
        </div>
      </>
    );
  } else if (cat) {
    const Icon = resolveLucideIcon(cat.iconName);
    inner = (
      <>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: `oklch(0.55 0.18 ${cat.hue} / 0.18)`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: `oklch(0.85 0.16 ${cat.hue})`,
          }}
        >
          <Icon size={14} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: O.ink }}>{cat.label}</span>
      </>
    );
  } else {
    inner = (
      <>
        <Sparkles size={14} style={{ color: O.ink3 }} />
        <span style={{ fontSize: 13, color: O.ink3 }}>Pick a category</span>
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px 8px 10px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${O.hair2}`,
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        transition: "border-color 120ms ease, background 120ms ease",
      }}
      className="hover:border-cyan-400/40 hover:bg-white/[0.05]"
    >
      {inner}
      <ChevronDown size={14} style={{ color: O.ink3, marginLeft: "auto" }} />
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
      <div
        style={{
          fontSize: 11,
          color: O.ink3,
          fontFamily: O.mono,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${O.hair2}`,
          fontFamily: O.mono,
          fontSize: 12.5,
        }}
      >
        <code
          style={{
            flex: 1,
            color: O.ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {display}
        </code>
        {secret && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            style={{
              color: O.ink3,
              padding: 4,
              borderRadius: 6,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            aria-label={revealed ? "Hide" : "Reveal"}
          >
            {revealed ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          style={{
            color: O.ink2,
            padding: 4,
            borderRadius: 6,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          aria-label="Copy"
        >
          <Copy style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </div>
  );
}

function SetupGuide() {
  return (
    <div style={{ ...panel(), padding: 22 }}>
      <Eyebrow>◆&nbsp;&nbsp;SETUP GUIDE</Eyebrow>

      <Section title="OBS Studio (desktop)">
        <Step n={1}>
          Open OBS &rarr; <strong>Settings</strong> &rarr; <strong>Stream</strong>.
        </Step>
        <Step n={2}>
          Service: <code style={code}>Custom...</code>
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

      <p
        style={{
          fontSize: 12,
          color: O.ink3,
          marginTop: 12,
          fontStyle: "italic",
          lineHeight: 1.5,
        }}
      >
        Your stream key never expires. Don&apos;t share it. Anyone with it
        can broadcast as you. If it leaks, contact support to rotate.
      </p>
    </div>
  );
}

const code: React.CSSProperties = {
  fontFamily: O.mono,
  fontSize: 11,
  padding: "1px 6px",
  borderRadius: 4,
  background: "rgba(255,255,255,0.06)",
  border: `1px solid ${O.hair2}`,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: O.ink,
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Radio style={{ width: 14, height: 14, color: "#ff5a6a" }} />
        {title}
      </div>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </ol>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        fontSize: 13,
        color: O.ink2,
        lineHeight: 1.5,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          borderRadius: 6,
          background: "rgba(255,255,255,0.06)",
          border: `1px solid ${O.hair2}`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontFamily: O.mono,
          color: O.ink3,
        }}
      >
        {n}
      </span>
      <span style={{ paddingTop: 1 }}>{children}</span>
    </li>
  );
}
