"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
}

// Previews are derived at render time from content, so this regex is the
// single source of "does this text link somewhere" for posts and DMs.
const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

/** First http(s) URL in a piece of content, trailing punctuation stripped. */
export function extractFirstUrl(content: string): string | null {
  const match = content.match(URL_PATTERN);
  if (!match) return null;
  const cleaned = match[0].replace(/[)\]}>.,;:!?'"]+$/, "");
  try {
    new URL(cleaned);
  } catch {
    return null;
  }
  return cleaned;
}

// Server-side cache is fresh for 7 days; a day on the client avoids
// refetching the same link while someone scrolls a feed.
const PREVIEW_STALE_TIME_MS = 24 * 60 * 60 * 1000;

interface LinkPreviewCardProps {
  url: string;
  /** "message" tones the card down to sit inside a DM bubble. */
  variant?: "post" | "message";
}

export function LinkPreviewCard({ url, variant = "post" }: LinkPreviewCardProps) {
  const { data } = useQuery({
    queryKey: ["link-preview", url],
    queryFn: async (): Promise<LinkPreview | null> => {
      // Fail silent by contract: any failure means "no card", never an
      // error state, so the queryFn swallows instead of throwing.
      try {
        const res = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`);
        if (!res.ok) return null;
        return (await res.json()) as LinkPreview;
      } catch {
        return null;
      }
    },
    staleTime: PREVIEW_STALE_TIME_MS,
    retry: false,
  });

  if (!data || (!data.title && !data.description && !data.image_url)) return null;

  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    hostname = url;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "flex items-stretch gap-3 overflow-hidden rounded-xl border no-underline transition-colors",
        variant === "post"
          ? "border-border bg-surface hover:bg-muted/50"
          : "border-black/20 bg-black/15 hover:bg-black/25",
      )}
    >
      {data.image_url && (
        // Preview images come from arbitrary external hosts that
        // next/image's remotePatterns can't enumerate.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.image_url}
          alt=""
          loading="lazy"
          className="h-[76px] w-[76px] shrink-0 object-cover"
        />
      )}
      <div className={cn("min-w-0 flex-1 self-center py-2 pr-3", !data.image_url && "pl-3")}>
        <p className="m-0 truncate text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
          {data.site_name ?? hostname}
        </p>
        {data.title && (
          <p className="m-0 mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
            {data.title}
          </p>
        )}
        {data.description && (
          <p className="m-0 mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
}
