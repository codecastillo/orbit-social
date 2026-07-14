"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Radio, Eye, Sparkles } from "lucide-react";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  getLiveStreams,
  type LiveStreamWithProfile,
} from "@/lib/queries/live";
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
      <div className="flex flex-col gap-[18px] text-foreground">
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
        sub="When people you follow go live, you'll find their streams here. Set up your stream key once in OBS or your IRL backpack and you'll appear here automatically when you start broadcasting."
        ctaLabel="Set up streaming"
        ctaIcon={<Radio className="h-3 w-3" />}
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
    <div className="flex min-w-0 flex-col gap-[18px] text-foreground">
      <div>
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
          ◆&nbsp;&nbsp;ON AIR · {streams.length} LIVE
        </p>
        <h1 className="mt-2 text-[44px] font-bold leading-none tracking-[-0.035em]">
          Live and <span className="text-primary">unrehearsed</span>.
        </h1>
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
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
                ◆&nbsp;&nbsp;ALSO LIVE · {others.length}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
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
    <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
      <CategoryChip
        active={isAll}
        onClick={() => onSelect({ kind: "all" })}
        icon={Sparkles}
        label="All"
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
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-[34px] shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-bold transition-colors",
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border bg-surface text-text-secondary hover:text-foreground",
      )}
    >
      <Icon size={13} className="opacity-90" />
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
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-7 text-center">
      <p className="text-sm text-text-secondary">
        No live streams in {label} right now
      </p>
      <Button variant="outline" onClick={onShowAll}>
        Show all
      </Button>
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
    const SAFETY = 2;
    const recompute = () => {
      const w = el.clientWidth - SAFETY;
      if (w <= 0) return;
      const fits = Math.max(1, Math.floor((w + GAP) / (CARD_W + GAP)));
      setVisibleCount(Math.min(fits, LIVE_GAMES.length));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    window.addEventListener("resize", recompute);
    const t = setTimeout(recompute, 100);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
      clearTimeout(t);
    };
  }, []);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
          ◆&nbsp;&nbsp;RECOMMENDED GAMES
        </p>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="cursor-pointer border-none bg-transparent p-0 font-mono text-[11.5px] tracking-[0.06em] text-text-secondary transition-colors hover:text-primary"
        >
          VIEW ALL
        </button>
      </div>
      <div ref={railRef} className="mt-3 flex flex-nowrap gap-3 overflow-hidden">
        {LIVE_GAMES.slice(0, visibleCount).map((g) => {
          const liveCount = streams.filter((s) => s.game_slug === g.slug).length;
          return (
            <GameCard
              key={g.slug}
              label={g.label}
              slug={g.slug}
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
  liveCount,
  onClick,
}: {
  label: string;
  slug: LiveGameSlug;
  liveCount: number;
  onClick: () => void;
}) {
  const [errored, setErrored] = useState(false);
  const src = coverArtUrl(slug);
  return (
    <div className="w-[140px] shrink-0">
      <button
        onClick={onClick}
        className="relative h-[190px] w-[140px] cursor-pointer overflow-hidden rounded-xl border border-border bg-surface p-0 transition-all hover:ring-2 hover:ring-primary/40"
      >
        {!errored && src ? (
          <img
            src={src}
            alt={label}
            onError={() => setErrored(true)}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-elevated p-2.5 text-center text-sm font-extrabold leading-tight text-foreground">
            {label}
          </div>
        )}
        {/* Legibility scrim so the title reads over cover art */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent to-50%" />
        <div className="absolute inset-x-2 bottom-2 text-left text-xs font-bold leading-tight text-white">
          {label}
        </div>
      </button>
      <div className="mt-1.5 font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
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
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

/* ─── Featured live tile (with overlay header + actions) ─────────── */

function FeaturedLive({ stream }: { stream: LiveStreamWithProfile }) {
  const now = useLiveClock();
  return (
    <Link
      href={`/live/${stream.id}`}
      className="relative block overflow-hidden rounded-xl border border-border bg-surface text-foreground no-underline"
    >
      <div className="relative aspect-video bg-surface-elevated">
        <LiveThumbnail
          playbackId={stream.mux_playback_id}
          alt={stream.title || "Live"}
          status={stream.status}
          startedAt={stream.started_at}
        />

        {/* Top badges */}
        <div className="absolute left-[18px] top-[18px] flex gap-2">
          <LiveBadge variant="pill" pulse>
            LIVE
          </LiveBadge>
          <div className="rounded-full bg-black/50 px-3 py-1.5 font-mono text-[11px] tracking-[0.06em] text-white backdrop-blur-md">
            ◉ {stream.viewer_count ?? 0} watching · {formatElapsed(stream.started_at, now)}
          </div>
        </div>

        {/* Bottom title strip over a legibility scrim */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-7">
          <div className="flex flex-wrap items-center gap-3">
            <UserAvatar
              src={stream.profiles.avatar_url}
              fallback={stream.profiles.display_name}
              size="lg"
            />
            <div className="min-w-0">
              <h2 className="text-2xl font-bold leading-none tracking-[-0.035em] text-white">
                {stream.title}
              </h2>
              <div className="mt-0.5 text-xs text-white/70">
                {stream.profiles.display_name} · @{stream.profiles.username}
              </div>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button>Join the room →</Button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── small live tile ────────────────────────────────────────────── */

function SmallLiveTile({ stream }: { stream: LiveStreamWithProfile }) {
  return (
    <Link
      href={`/live/${stream.id}`}
      className="block overflow-hidden rounded-xl border border-border bg-surface text-foreground no-underline"
    >
      <div className="relative aspect-video bg-surface-elevated">
        <LiveThumbnail
          playbackId={stream.mux_playback_id}
          alt={stream.title || "Live"}
          status={stream.status}
          startedAt={stream.started_at}
        />
        <div className="absolute left-2.5 top-2.5">
          <LiveBadge variant="corner" pulse />
        </div>
        <div className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-[3px] text-[11px] font-bold text-white backdrop-blur-md">
          <Eye className="h-[11px] w-[11px]" />
          {stream.viewer_count ?? 0}
        </div>
      </div>
      <div className="flex items-center gap-2.5 p-3.5">
        <UserAvatar
          src={stream.profiles.avatar_url}
          fallback={stream.profiles.display_name}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[13px] font-bold leading-[1.3]">
            {stream.title || "Untitled stream"}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {stream.profiles.display_name}
          </div>
        </div>
      </div>
    </Link>
  );
}
