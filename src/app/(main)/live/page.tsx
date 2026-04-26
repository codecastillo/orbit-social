"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Radio, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  getLiveStreams,
  type LiveStreamWithProfile,
} from "@/lib/queries/live";
import { O, aurora, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";
import { LiveBadge } from "@/components/orbit/live-badge";

function hueFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = seed.charCodeAt(i) + ((h << 5) - h);
  }
  const hues = [18, 220, 290, 145, 50, 340, 180, 265];
  return hues[Math.abs(h) % hues.length];
}

function elapsedSince(iso: string | null): string {
  if (!iso) return "00:00";
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${(m % 60).toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function LivePage() {
  const router = useRouter();
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

  const featured = streams[0];
  const others = streams.slice(1);

  return (
    <div
      style={{
        color: O.ink,
        fontFamily: O.sans,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 320px",
        gap: 18,
      }}
      className="xl:grid-cols-[minmax(0,1fr)_320px] grid-cols-1"
    >
      {/* Main column */}
      <main
        style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}
      >
        <div>
          <Eyebrow accent>
            ◆&nbsp;&nbsp;ON AIR · {streams.length} LIVE
          </Eyebrow>
          <Display size={44} style={{ marginTop: 8 }}>
            Live and <Acc>unrehearsed</Acc>.
          </Display>
        </div>

        <FeaturedLive stream={featured} onGoLive={goToStreamSettings} />

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
      </main>

      {/* Live chat rail */}
      <ChatRail stream={featured} />
    </div>
  );
}

/* ─── Featured live tile (with overlay header + actions) ─────────── */

function FeaturedLive({
  stream,
  onGoLive,
}: {
  stream: LiveStreamWithProfile;
  onGoLive: () => void;
}) {
  const hue = hueFor(stream.id);
  const hue2 = (hue + 80) % 360;
  return (
    <div
      style={{
        ...panel(),
        padding: 0,
        overflow: "hidden",
        position: "relative",
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
            ◉ {stream.viewer_count ?? 0} watching · {elapsedSince(stream.started_at)}
          </div>
        </div>

        <PillBtn
          size="sm"
          onClick={onGoLive}
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            color: "white",
            background: "rgba(0,0,0,0.4)",
          }}
        >
          <Radio style={{ width: 12, height: 12 }} /> Go live
        </PillBtn>

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
              <PillBtn>+ Tip</PillBtn>
              <Link href={`/live/${stream.id}`}>
                <PillBtn primary>Join the room →</PillBtn>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
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
          {elapsedSince(stream.started_at)}
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
          <div style={{ fontSize: 11, color: O.ink3 }}>
            {stream.profiles.display_name.split(" ")[0]} · {stream.viewer_count ?? 0}{" "}
            watching
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── chat rail (mock — real chat lives in /live/[streamId]) ───── */

function ChatRail({ stream }: { stream: LiveStreamWithProfile }) {
  return (
    <aside
      style={{
        ...panel(),
        overflow: "hidden",
        height: "fit-content",
        position: "sticky",
        top: 24,
        maxHeight: "calc(100vh - 48px)",
        flexDirection: "column",
      }}
      className="hidden xl:flex"
    >
      <div
        style={{
          padding: "18px 20px",
          borderBottom: `1px solid ${O.hair}`,
        }}
      >
        <Eyebrow accent>
          ◆&nbsp;&nbsp;ROOM CHAT · {stream.viewer_count ?? 0} IN
        </Eyebrow>
        <p
          style={{
            fontSize: 13,
            color: O.ink2,
            marginTop: 6,
            lineHeight: 1.5,
          }}
        >
          Slow chat — a new message every few seconds. No spam.
        </p>
      </div>
      <div
        style={{
          flex: 1,
          padding: "14px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minHeight: 280,
          color: O.ink3,
          fontSize: 12.5,
          textAlign: "center",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Radio style={{ width: 18, height: 18, color: O.ink3 }} />
        Join the room to chat with the crowd.
      </div>
      <div
        style={{
          padding: 14,
          borderTop: `1px solid ${O.hair}`,
          display: "flex",
          gap: 8,
        }}
      >
        <Link
          href={`/live/${stream.id}`}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 99,
            background: O.glass,
            border: `1px solid ${O.hair}`,
            fontSize: 13,
            color: O.ink3,
            textDecoration: "none",
          }}
        >
          Say something kind…
        </Link>
        <Link href={`/live/${stream.id}`}>
          <button
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: aurora,
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 4px 14px ${O.a1}80`,
              cursor: "pointer",
            }}
          >
            <Send style={{ width: 14, height: 14, color: "white" }} />
          </button>
        </Link>
      </div>
    </aside>
  );
}

