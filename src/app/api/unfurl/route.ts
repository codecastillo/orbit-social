import { lookup } from "node:dns/promises";
import { NextResponse } from "next/server";
import { createBearerClient, createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import {
  isBlockedIp,
  parseLinkMeta,
  validatePublicHttpUrl,
  type LinkMeta,
} from "@/lib/unfurl";

export const runtime = "nodejs";
export const maxDuration = 15;

const noStore = { "Cache-Control": "no-store, max-age=0" };

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5_000;
const MAX_BODY_BYTES = 500 * 1024;
const MAX_REDIRECTS = 3;
const RATE_LIMIT_PER_MINUTE = 30;
// Some sites serve empty pages to obvious bots; a plain browser UA gets
// the same markup a normal visitor would.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const EMPTY_META: LinkMeta = {
  title: null,
  description: null,
  image_url: null,
  site_name: null,
};

/** Resolve the hostname and refuse it if any address is private/internal. */
async function assertPublicHost(url: URL) {
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error("unresolvable host");
  for (const { address } of addresses) {
    if (isBlockedIp(address)) throw new Error("blocked address");
  }
}

/**
 * Fetch the page with manual redirect handling so every hop gets the same
 * URL + DNS screening as the original (a public URL 302ing to an internal
 * one is the classic unfurler SSRF).
 */
async function fetchHtml(
  target: URL,
  signal: AbortSignal,
): Promise<{ html: string; finalUrl: string } | null> {
  let current = target;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(current);
    const res = await fetch(current, {
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      res.body?.cancel().catch(() => {});
      if (!location) return null;
      const next = validatePublicHttpUrl(new URL(location, current).href);
      if (!next) return null;
      current = next;
      continue;
    }

    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      res.body?.cancel().catch(() => {});
      return null;
    }

    // Stream with a hard byte cap; the meta tags live in <head>, so a
    // truncated document still parses fine.
    const reader = res.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let html = "";
    let received = 0;
    while (received < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});
    return { html, finalUrl: current.href };
  }
  return null;
}

export async function GET(request: Request) {
  // Native clients have no auth cookies; they send the session access
  // token as a Bearer header instead, same as the live chat route.
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;
  const supabase = bearerToken
    ? createBearerClient(authorization!)
    : await createClient();
  const { data: { user } } = await supabase.auth.getUser(bearerToken);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  const raw = new URL(request.url).searchParams.get("url");
  const target = raw ? validatePublicHttpUrl(raw) : null;
  if (!target) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400, headers: noStore });
  }

  if (!rateLimit(`unfurl:${user.id}`, RATE_LIMIT_PER_MINUTE, 60_000).success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: noStore });
  }

  const cacheKey = target.href;
  const admin = createAdminClient();
  const { data: cached } = await admin
    .from("link_previews")
    .select("url, title, description, image_url, site_name, fetched_at")
    .eq("url", cacheKey)
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) {
    return NextResponse.json(
      {
        url: cached.url,
        title: cached.title,
        description: cached.description,
        image_url: cached.image_url,
        site_name: cached.site_name,
      },
      { headers: noStore },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let meta: LinkMeta | null = null;
  try {
    const page = await fetchHtml(target, controller.signal);
    if (page) meta = parseLinkMeta(page.html, page.finalUrl);
  } catch {
    // Timeouts, DNS failures, and blocked hosts all degrade to "no
    // preview"; the clients render nothing rather than an error.
  } finally {
    clearTimeout(timer);
  }

  // Only cache real responses (even all-null ones, so unfurlable-but-bare
  // pages aren't refetched); transient network failures stay uncached.
  if (meta) {
    const { error } = await admin.from("link_previews").upsert(
      { url: cacheKey, ...meta, fetched_at: new Date().toISOString() },
      { onConflict: "url" },
    );
    if (error) console.error("link_previews upsert failed", error);
  }

  return NextResponse.json({ url: cacheKey, ...(meta ?? EMPTY_META) }, { headers: noStore });
}
