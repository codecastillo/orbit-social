import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const alt = "A profile on Orbit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BIO_EXCERPT_LENGTH = 140;

function excerpt(text: string): string {
  if (text.length <= BIO_EXCERPT_LENGTH) return text;
  return `${text.slice(0, BIO_EXCERPT_LENGTH).trimEnd()}…`;
}

function formatFollowers(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return `${count}`;
}

// Satori supports neither CSS variables nor color-mix, so the brand values
// are literal here, matching src/app/opengraph-image.tsx.
function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          background: "#ac77fa",
          display: "flex",
        }}
      />
      <div style={{ fontSize: 28, fontWeight: 700 }}>Orbit</div>
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, bio, follower_count")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 32,
            background: "#0b0b0d",
            color: "#f0eff2",
            fontFamily: "sans-serif",
          }}
        >
          <Wordmark />
          <div style={{ fontSize: 40, fontWeight: 700 }}>A profile on Orbit</div>
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#0b0b0d",
          color: "#f0eff2",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "-2px",
            }}
          >
            {profile.display_name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ fontSize: 32, color: "#ac77fa" }}>@{username}</div>
            <div style={{ fontSize: 32, color: "#a5a3a8" }}>
              {formatFollowers(profile.follower_count ?? 0)} followers
            </div>
          </div>
        </div>
        {profile.bio ? (
          <div
            style={{
              fontSize: 36,
              lineHeight: 1.35,
              color: "#a5a3a8",
            }}
          >
            {excerpt(profile.bio)}
          </div>
        ) : null}
        <Wordmark />
      </div>
    ),
    { ...size }
  );
}
