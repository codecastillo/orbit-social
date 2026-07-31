import { isIP } from "node:net";

// URL validation and OpenGraph parsing for the /api/unfurl route. Pure
// helpers live here (no Next imports) so they stay unit-testable.

export interface LinkMeta {
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
}

// RFC-special and cloud-internal IPv4 space: anything here is never a
// public website, so a URL resolving into it is an SSRF attempt.
// [base, prefixBits] pairs.
const BLOCKED_IPV4_RANGES: [number, number][] = [
  [ipv4ToInt("0.0.0.0")!, 8], // "this network"
  [ipv4ToInt("10.0.0.0")!, 8], // private
  [ipv4ToInt("100.64.0.0")!, 10], // carrier-grade NAT
  [ipv4ToInt("127.0.0.0")!, 8], // loopback
  [ipv4ToInt("169.254.0.0")!, 16], // link-local, incl. cloud metadata
  [ipv4ToInt("172.16.0.0")!, 12], // private
  [ipv4ToInt("192.0.0.0")!, 24], // IETF protocol assignments
  [ipv4ToInt("192.168.0.0")!, 16], // private
  [ipv4ToInt("198.18.0.0")!, 15], // benchmarking
  [ipv4ToInt("224.0.0.0")!, 3], // multicast + reserved + broadcast
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    n = n * 256 + value;
  }
  return n;
}

/** True when an IP (v4 or v6, as returned by dns.lookup) must not be fetched. */
export function isBlockedIp(ip: string): boolean {
  const lower = ip.toLowerCase();
  const mapped = lower.startsWith("::ffff:") ? lower.slice(7) : null;
  const v4Candidate = mapped ?? (lower.includes(":") ? null : lower);

  if (v4Candidate !== null) {
    // Hex-form mapped addresses (::ffff:7f00:1) are not worth normalizing;
    // no legitimate site publishes one, so fail closed.
    if (!v4Candidate.includes(".")) return true;
    const n = ipv4ToInt(v4Candidate);
    if (n === null) return true;
    return BLOCKED_IPV4_RANGES.some(
      ([base, bits]) => n >>> (32 - bits) === base >>> (32 - bits),
    );
  }

  if (lower === "::" || lower === "::1") return true;
  if (/^f[cd]/.test(lower)) return true; // fc00::/7 unique local
  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link-local
  if (lower.startsWith("ff")) return true; // multicast
  return false;
}

/** Hostname-level SSRF screen, applied before DNS resolution. */
export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const literal = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (isIP(literal)) return isBlockedIp(literal);
  // Bare names (localhost, router, an internal service) only resolve on a
  // LAN, and the mDNS/infra suffixes never name a public site.
  if (!host.includes(".")) return true;
  return (
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  );
}

/**
 * Parse and screen a user-supplied URL: http(s) only, default ports only,
 * no credentials, no obviously internal hostnames. Returns the normalized
 * URL (hash stripped) or null. DNS-level checks happen separately, after
 * resolution.
 */
export function validatePublicHttpUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.port !== "" && url.port !== "80" && url.port !== "443") return null;
  if (url.username || url.password) return null;
  if (isBlockedHostname(url.hostname)) return null;
  url.hash = "";
  return url;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function metaContent(html: string, key: string): string | null {
  const tag = html.match(
    new RegExp(`<meta\\s[^>]*(?:property|name)\\s*=\\s*["']${key}["'][^>]*>`, "i"),
  )?.[0];
  const content = tag?.match(/content\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const raw = content?.[1] ?? content?.[2];
  return raw ? decodeEntities(raw) : null;
}

function clip(value: string | null | undefined, max: number): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

/**
 * Extract OpenGraph/Twitter card metadata from an HTML document, with a
 * <title> fallback. Regex-based on purpose: the fields live in flat <meta>
 * tags in <head>, which never needs a real HTML parser.
 */
export function parseLinkMeta(html: string, baseUrl: string): LinkMeta {
  const title =
    metaContent(html, "og:title") ??
    metaContent(html, "twitter:title") ??
    (() => {
      const tag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
      return tag ? decodeEntities(tag) : null;
    })();
  const description =
    metaContent(html, "og:description") ??
    metaContent(html, "twitter:description") ??
    metaContent(html, "description");
  const imageRaw =
    metaContent(html, "og:image") ??
    metaContent(html, "og:image:url") ??
    metaContent(html, "twitter:image") ??
    metaContent(html, "twitter:image:src");

  let image_url: string | null = null;
  if (imageRaw) {
    try {
      const resolved = new URL(imageRaw.trim(), baseUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        image_url = resolved.href;
      }
    } catch {
      // Broken image URL: drop it, the rest of the preview still renders.
    }
  }

  return {
    title: clip(title, 300),
    description: clip(description, 500),
    image_url,
    site_name: clip(metaContent(html, "og:site_name"), 100),
  };
}
