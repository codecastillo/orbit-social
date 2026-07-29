import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const alt = "A post on Orbit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const EXCERPT_LENGTH = 140;

function excerpt(text: string): string {
  if (text.length <= EXCERPT_LENGTH) return text;
  return `${text.slice(0, EXCERPT_LENGTH).trimEnd()}…`;
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
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("content, profiles!posts_user_id_fkey(display_name, username)")
    .eq("id", postId)
    .maybeSingle();

  const author = post?.profiles as unknown as {
    display_name: string;
    username: string;
  } | null;

  if (!post || !author) {
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
          <div style={{ fontSize: 40, fontWeight: 700 }}>A post on Orbit</div>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 40, fontWeight: 700 }}>
            {author.display_name}
          </div>
          <div style={{ fontSize: 28, color: "#ac77fa" }}>
            @{author.username}
          </div>
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 600,
            lineHeight: 1.25,
            letterSpacing: "-1px",
          }}
        >
          {excerpt(post.content || "")}
        </div>
        <Wordmark />
      </div>
    ),
    { ...size }
  );
}
