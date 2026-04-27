"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Radio, Eye, Sparkles } from "lucide-react";
import * as Icons from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  getLiveStreams,
  type LiveStreamWithProfile,
} from "@/lib/queries/live";
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { LiveBadge } from "@/components/orbit/live-badge";
import {
  LIVE_CATEGORIES,
  type LiveCategorySlug,
} from "@/lib/constants/live-categories";
import {
  LIVE_GAMES,
  LIVE_GAMES_BY_SLUG,
  coverArtUrl,
  isLiveGameSlug,
  type LiveGameSlug,
} from "@/lib/constants/live-games";
import { getMuxLiveThumbnailUrl } from "@/lib/services/mux";
import { CategoryPickerDialog } from "@/components/live/category-picker-dialog";
import { isLiveCategorySlug } from "@/lib/constants/live-categories";

const CATEGORY_LOOKUP: Record<string, (typeof LIVE_CATEGORIES)[number]> =
  Object.fromEntries(LIVE_CATEGORIES.map((c) => [c.slug, c]));

type StreamFilter =
  | { kind: "all" }
  | { kind: "category"; slug: LiveCategorySlug }
  | { kind: "game"; slug: LiveGameSlug };

function resolveLucideIcon(
  name: string,
): React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }> {
  const lookup = Icons as unknown as Record<
    string,
    React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>
  >;
  return lookup[name] ?? Sparkles;
}

function hueFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = seed.charCodeAt(i) + ((h << 5) - h);
  }
  const hues = [18, 220, 290, 145, 50, 340, 180, 265];
  return hues[Math.abs(h) % hues.length];
}

function formatElapsed(iso: string | null, now: number): string {
  if (!iso) return "00:00";
  const sec = Math.floor((now - new Date(iso).getTime()) / 1000);
  if (sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${(m % 60).toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function useLiveClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function LivePage() {
  const router = useRouter();
  const [filter, setFilter] = useState<StreamFilter>({ kind: "all" });
  const { data: streams, isLoading } = useQuery({
    queryKey: ["live-streams"],
    queryFn: getLiveStreams,
    refetchInterval: 15000,
  });

  const goToStreamSettings = () => router.push("/settings/streaming");

  if (isLoading) {
    return (
      <div
        style={{
          color: O.ink,
          fontFamily: O.sans,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <Skeleton className="h-[480px] w-full rounded-2xl" />
      </div>
    );
  }

  if (!streams || streams.length === 0) {
    return (
      <OrbitEmptyState
        icon={Radio}
        accent="#ff5a6a"
        headline="Nobody's"
        accentWord="on air"
        sub="When people you follow go live, you'll find their streams here. Set up your stream key once in OBS or your IRL backpack — you appear here automatically when you start broadcasting."
        ctaLabel="Set up streaming"
        ctaIcon={<Radio style={{ width: 12, height: 12 }} />}
        onCta={goToStreamSettings}
      />
    );
  }

  const filtered =
    filter.kind === "all"
      ? streams
      : filter.kind === "category"
        ? streams.filter((s) => s.category === filter.slug)
        : streams.filter((s) => s.game_slug === filter.slug);
  const featured = filtered[0];
  const others = filtered.slice(1);

  const filterLabel =
    filter.kind === "all"
      ? "All"
      : filter.kind === "category"
        ? CATEGORY_LOOKUP[filter.slug]?.label ?? filter.slug
        : LIVE_GAMES_BY_SLUG[filter.slug]?.label ?? filter.slug;

  return (
    <div
      style={{
        color: O.ink,
        fontFamily: O.sans,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        minWidth: 0,
      }}
    >
      <div>
        <Eyebrow accent>
          ◆&nbsp;&nbsp;ON AIR · {streams.length} LIVE
        </Eyebrow>
        <Display size={44} style={{ marginTop: 8 }}>
          Live and <Acc>unrehearsed</Acc>.
        </Display>
      </div>

      <CategoryChipRow filter={filter} onSelect={setFilter} />

      {filtered.length === 0 ? (
        <EmptyCategoryState
          label={filterLabel}
          onShowAll={() => setFilter({ kind: "all" })}
        />
      ) : (
        <>
          {featured && <FeaturedLive stream={featured} />}

          <RecommendedCategoriesRail
            streams={streams}
            onPickGame={(slug) => setFilter({ kind: "game", slug })}
            onPickCategory={(slug) => setFilter({ kind: "category", slug })}
          />

          {others.length > 0 && (
            <div>
              <Eyebrow accent>◆&nbsp;&nbsp;ALSO LIVE · {others.length}</Eyebrow>
              <div
                style={{
                  display: "grid",
                  gap: 14,
                  marginTop: 12,
                }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              >
                {others.map((s) => (
                  <SmallLiveTile key={s.id} stream={s} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CategoryChipRow({
  filter,
  onSelect,
}: {
  filter: StreamFilter;
  onSelect: (next: StreamFilter) => void;
}) {
  const isAll = filter.kind === "all";
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        paddingBottom: 4,
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
      className="scrollbar-hide"
    >
      <CategoryChip
        active={isAll}
        onClick={() => onSelect({ kind: "all" })}
        icon={Sparkles}
        label="All"
        hue={210}
      />
      {LIVE_CATEGORIES.map((c) => {
        const Icon = resolveLucideIcon(c.iconName);
        const active = filter.kind === "category" && filter.slug === c.slug;
        return (
          <CategoryChip
            key={c.slug}
            active={active}
            onClick={() => onSelect({ kind: "category", slug: c.slug })}
            icon={Icon}
            label={c.label}
            hue={c.hue}
          />
        );
      })}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  icon: Icon,
  label,
  hue,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  hue: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        height: 34,
        padding: "0 14px",
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12.5,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
        background: active ? `oklch(0.55 0.18 ${hue} / 0.22)` : "rgba(255,255,255,0.03)",
        color: active ? `oklch(0.85 0.16 ${hue})` : O.ink2,
        border: active
          ? `1px solid oklch(0.65 0.18 ${hue} / 0.5)`
          : "1px solid rgba(255,255,255,0.08)",
        fontFamily: O.sans,
      }}
    >
      <Icon size={13} style={{ opacity: 0.9 }} />
      {label}
    </button>
  );
}

function EmptyCategoryState({
  label,
  onShowAll,
}: {
  label: string;
  onShowAll: () => void;
}) {
  return (
    <div
      style={{
        ...panel(),
        padding: 28,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <p style={{ color: O.ink2, fontSize: 14 }}>
        No live streams in {label} right now
      </p>
      <PillBtn onClick={onShowAll}>Show all</PillBtn>
    </div>
  );
}

function RecommendedCategoriesRail({
  streams,
  onPickGame,
  onPickCategory,
}: {
  streams: LiveStreamWithProfile[];
  onPickGame: (slug: LiveGameSlug) => void;
  onPickCategory: (slug: LiveCategorySlug) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const railRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(LIVE_GAMES.length);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const CARD_W = 140;
    const GAP = 12;
    const recompute = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const fits = Math.max(1, Math.floor((w + GAP) / (CARD_W + GAP)));
      setVisibleCount(Math.min(fits, LIVE_GAMES.length));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <Eyebrow accent>◆&nbsp;&nbsp;RECOMMENDED GAMES</Eyebrow>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          style={{
            fontSize: 11.5,
            color: O.ink2,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: O.mono,
            letterSpacing: "0.06em",
          }}
          className="hover:text-cyan-300 transition-colors"
        >
          VIEW ALL
        </button>
      </div>
      <div
        ref={railRef}
        style={{
          display: "flex",
          gap: 12,
          marginTop: 12,
          flexWrap: "nowrap",
          overflow: "hidden",
        }}
      >
        {LIVE_GAMES.slice(0, visibleCount).map((g) => {
          const liveCount = streams.filter((s) => s.game_slug === g.slug).length;
          return (
            <GameCard
              key={g.slug}
              label={g.label}
              slug={g.slug}
              accentHue={g.accentHue}
              liveCount={liveCount}
              onClick={() => onPickGame(g.slug)}
            />
          );
        })}
      </div>
      <CategoryPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        value={{ category: null, gameSlug: null }}
        onSave={(next) => {
          setPickerOpen(false);
          if (next.gameSlug && isLiveGameSlug(next.gameSlug)) {
            onPickGame(next.gameSlug);
          } else if (next.category && isLiveCategorySlug(next.category)) {
            onPickCategory(next.category);
          }
        }}
      />
    </div>
  );
}

function GameCard({
  label,
  slug,
  accentHue,
  liveCount,
  onClick,
}: {
  label: string;
  slug: LiveGameSlug;
  accentHue: number;
  liveCount: number;
  onClick: () => void;
}) {
  const [errored, setErrored] = useState(false);
  const src = coverArtUrl(slug);
  return (
    <div style={{ flexShrink: 0, width: 140 }}>
      <button
        onClick={onClick}
        style={{
          width: 140,
          height: 190,
          borderRadius: 18,
          overflow: "hidden",
          position: "relative",
          padding: 0,
          cursor: "pointer",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
        }}
        className="hover:ring-2 hover:ring-cyan-400/40 transition-all"
      >
        {!errored && src ? (
          <img
            src={src}
            alt={label}
            onError={() => setErrored(true)}
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 10,
              textAlign: "center",
              background: `oklch(0.4 0.18 ${accentHue})`,
              color: "rgba(255,255,255,0.95)",
              fontSize: 14,
              fontWeight: 800,
              lineHeight: 1.15,
            }}
          >
            {label}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85), transparent 50%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: 8,
            color: "white",
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.2,
            textAlign: "left",
          }}
        >
          {label}
        </div>
      </button>
      <div
        style={{
          marginTop: 6,
          fontSize: 11,
          color: O.ink3,
          fontFamily: O.mono,
          letterSpacing: "0.04em",
        }}
      >
        {liveCount} LIVE
      </div>
    </div>
  );
}

/* ─── Live thumbnail (Mux still frame, refreshes every 30s) ─────── */

function LiveThumbnail({
  playbackId,
  alt,
  status,
  startedAt,
}: {
  playbackId: string | null;
  alt: string;
  status: "idle" | "live" | "ended";
  startedAt: string | null;
}) {
  const [tick, setTick] = useState(0);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!playbackId || errored || status !== "live") return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [playbackId, errored, status]);

  if (!playbackId || errored || status !== "live") return null;
  const src = getMuxLiveThumbnailUrl(playbackId, { sessionStartedAt: startedAt });
  return (
    <img
      key={`${startedAt ?? "none"}-${tick}`}
      src={src}
      alt={alt}
      onError={() => setErrored(true)}
      draggable={false}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  );
}

/* ─── Featured live tile (with overlay header + actions) ─────────── */

function FeaturedLive({ stream }: { stream: LiveStreamWithProfile }) {
  const hue = hueFor(stream.id);
  const hue2 = (hue + 80) % 360;
  const now = useLiveClock();
  return (
    <Link
      href={`/live/${stream.id}`}
      style={{
        ...panel(),
        padding: 0,
        overflow: "hidden",
        position: "relative",
        textDecoration: "none",
        color: O.ink,
        display: "block",
      }}
    >
      <div
        style={{
          aspectRatio: "16/9",
          background: `linear-gradient(160deg, oklch(0.45 0.18 ${hue}) 0%, oklch(0.3 0.14 ${hue2}) 50%, oklch(0.2 0.1 220) 100%)`,
          position: "relative",
        }}
      >
        <LiveThumbnail
          playbackId={stream.mux_playback_id}
          alt={stream.title || "Live"}
          status={stream.status}
          startedAt={stream.started_at}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 70% 35%, rgba(255,200,100,0.4), transparent 50%)",
          }}
        />

        {/* Top badges */}
        <div
          style={{
            position: "absolute",
            top: 18,
            left: 18,
            display: "flex",
            gap: 8,
          }}
        >
          <LiveBadge variant="pill" pulse>
            LIVE
          </LiveBadge>
          <div
            style={{
              padding: "6px 12px",
              borderRadius: 99,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(20px)",
              fontSize: 11,
              fontFamily: O.mono,
              color: "white",
              letterSpacing: "0.06em",
            }}
          >
            ◉ {stream.viewer_count ?? 0} watching · {formatElapsed(stream.started_at, now)}
          </div>
        </div>

        {/* Bottom title strip */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: 28,
            background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <UserAvatar
              src={stream.profiles.avatar_url}
              fallback={stream.profiles.display_name}
              size="lg"
            />
            <div style={{ minWidth: 0 }}>
              <Display size={24}>
                {stream.title}
              </Display>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.7)",
                  marginTop: 2,
                }}
              >
                {stream.profiles.display_name} · @{stream.profiles.username}
              </div>
            </div>
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <PillBtn primary>Join the room →</PillBtn>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── small live tile ────────────────────────────────────────────── */

function SmallLiveTile({ stream }: { stream: LiveStreamWithProfile }) {
  const hue = hueFor(stream.id);
  const hue2 = (hue + 60) % 360;
  return (
    <Link
      href={`/live/${stream.id}`}
      style={{
        ...panel(),
        padding: 0,
        overflow: "hidden",
        cursor: "pointer",
        textDecoration: "none",
        color: O.ink,
        display: "block",
      }}
    >
      <div
        style={{
          aspectRatio: "16/9",
          background: `linear-gradient(135deg, oklch(0.55 0.18 ${hue}), oklch(0.3 0.12 ${hue2}))`,
          position: "relative",
        }}
      >
        <LiveThumbnail
          playbackId={stream.mux_playback_id}
          alt={stream.title || "Live"}
          status={stream.status}
          startedAt={stream.started_at}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(135deg, transparent 0 18px, rgba(0,0,0,0.06) 18px 19px)",
          }}
        />
        <div style={{ position: "absolute", top: 10, left: 10 }}>
          <LiveBadge variant="corner" pulse />
        </div>
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            padding: "3px 8px",
            borderRadius: 6,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(8px)",
            fontSize: 11,
            color: "white",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontWeight: 700,
          }}
        >
          <Eye style={{ width: 11, height: 11 }} />
          {stream.viewer_count ?? 0}
        </div>
      </div>
      <div
        style={{
          padding: 14,
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <UserAvatar
          src={stream.profiles.avatar_url}
          fallback={stream.profiles.display_name}
          size="sm"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {stream.title || "Untitled stream"}
          </div>
          <div style={{ fontSize: 11, color: O.ink3, marginTop: 4 }}>
            {stream.profiles.display_name}
          </div>
        </div>
      </div>
    </Link>
  );
}

