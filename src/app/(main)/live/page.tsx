"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
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

const CATEGORY_LOOKUP: Record<string, (typeof LIVE_CATEGORIES)[number]> =
  Object.fromEntries(LIVE_CATEGORIES.map((c) => [c.slug, c]));

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
  const [selectedCategory, setSelectedCategory] =
    useState<LiveCategorySlug | null>(null);
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

  const filtered = selectedCategory
    ? streams.filter((s) => s.category === selectedCategory)
    : streams;
  const featured = filtered[0];
  const others = filtered.slice(1);

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

      <CategoryChipRow
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {filtered.length === 0 ? (
        <EmptyCategoryState onShowAll={() => setSelectedCategory(null)} />
      ) : (
        <>
          {featured && <FeaturedLive stream={featured} />}

          {others.length > 0 && (
            <div>
              <Eyebrow accent>◆&nbsp;&nbsp;ALSO LIVE · {others.length}</Eyebrow>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  marginTop: 12,
                }}
                className="md:grid-cols-2 grid-cols-1"
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
  selected,
  onSelect,
}: {
  selected: LiveCategorySlug | null;
  onSelect: (slug: LiveCategorySlug | null) => void;
}) {
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
        active={selected === null}
        onClick={() => onSelect(null)}
        emoji="✦"
        label="All"
        hue={210}
      />
      {LIVE_CATEGORIES.map((c) => (
        <CategoryChip
          key={c.slug}
          active={selected === c.slug}
          onClick={() => onSelect(c.slug)}
          emoji={c.emoji}
          label={c.label}
          hue={c.hue}
        />
      ))}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  emoji,
  label,
  hue,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
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
      <span style={{ fontSize: 14 }}>{emoji}</span>
      {label}
    </button>
  );
}

function EmptyCategoryState({ onShowAll }: { onShowAll: () => void }) {
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
        No live streams in this category right now
      </p>
      <PillBtn onClick={onShowAll}>Show all</PillBtn>
    </div>
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
  const now = useLiveClock();
  const category = stream.category ? CATEGORY_LOOKUP[stream.category] : null;
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
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(135deg, transparent 0 18px, rgba(0,0,0,0.06) 18px 19px)",
          }}
        />
        <div
          style={{ position: "absolute", top: 10, left: 10 }}
        >
          <LiveBadge variant="corner" pulse />
        </div>
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            padding: "3px 8px",
            borderRadius: 4,
            background: "rgba(0,0,0,0.5)",
            fontSize: 10,
            fontFamily: O.mono,
            color: "white",
          }}
        >
          {formatElapsed(stream.started_at, now)}
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
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {stream.title}
          </div>
          {category && (
            <div
              style={{
                marginTop: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 7px",
                borderRadius: 6,
                background: `oklch(0.55 0.18 ${category.hue} / 0.18)`,
                color: `oklch(0.85 0.16 ${category.hue})`,
                fontSize: 10.5,
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              <span>{category.emoji}</span>
              {category.label}
            </div>
          )}
          <div style={{ fontSize: 11, color: O.ink3, marginTop: category ? 4 : 0 }}>
            {stream.profiles.display_name.split(" ")[0]} · {stream.viewer_count ?? 0}{" "}
            watching
          </div>
        </div>
      </div>
    </Link>
  );
}

