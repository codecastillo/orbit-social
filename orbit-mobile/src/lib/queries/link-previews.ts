import { supabase } from "@/lib/supabase";

// Same web origin the live chat screen posts to. Unfurling happens on the
// server (SSRF screening, page fetch, OG parsing, shared cache); mobile
// never fetches arbitrary pages itself.
const UNFURL_API_BASE = "https://orbitsocial.net";

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
}

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

/**
 * Fetch a link preview through the web app's unfurl route, authenticated
 * with the Supabase session token. Resolves null on any failure: previews
 * are decoration, so nothing here is allowed to surface as an error.
 */
export async function getLinkPreview(url: string): Promise<LinkPreview | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;
    const res = await fetch(
      `${UNFURL_API_BASE}/api/unfurl?url=${encodeURIComponent(url)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    return (await res.json()) as LinkPreview;
  } catch {
    return null;
  }
}
