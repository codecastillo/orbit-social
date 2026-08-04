/**
 * Translates an orbitsocial.net path into the matching app route. Push
 * payloads carry web paths and universal links arrive as full web URLs, so
 * both go through this one translator.
 */

// Single-segment web paths that are real pages rather than usernames.
const ROOT_PATHS: Record<string, string> = {
  "/": "/(tabs)",
  "/feed": "/(tabs)",
  "/explore": "/(tabs)/discover",
  "/messages": "/(tabs)/messages",
  "/clips": "/(tabs)/clips",
  "/notifications": "/notifications",
  "/bookmarks": "/bookmarks",
  "/drafts": "/drafts",
  "/scheduled": "/scheduled",
  "/settings": "/settings",
  "/events": "/events",
  "/communities": "/communities",
  "/marketplace": "/marketplace",
  "/live": "/live",
};

// Web sections whose paths are identical on mobile.
const SHARED_PREFIXES = [
  "/post/",
  "/sound/",
  "/story/",
  "/events/",
  "/communities/",
  "/marketplace/",
  "/live/",
  "/vod/",
  "/settings/",
];

// Usernames are the web root fallback, so anything that reaches the profile
// rule has to look like one before it is treated as one.
const USERNAME = /^\/[A-Za-z0-9_.]{1,30}$/;

/**
 * @param webPath Path from an orbitsocial.net URL, query string included.
 * @param fallback Route to use when nothing matches; callers pick where an
 * unrecognized link should land.
 */
export function toMobilePath(webPath: string, fallback: string): string {
  const [rawPath = "/", query] = webPath.split("?");
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
  const route = resolve(path, fallback);
  return query ? `${route}?${query}` : route;
}

function resolve(path: string, fallback: string): string {
  const root = ROOT_PATHS[path];
  if (root) return root;

  if (path === "/notifications/requests") return "/follow-requests";
  if (path.startsWith("/messages/")) {
    return path.replace("/messages/", "/conversation/");
  }
  // Mobile plays every clip in one pager, so a single clip link opens the
  // pager rather than a route of its own.
  if (path.startsWith("/clips/")) return "/(tabs)/clips";
  if (SHARED_PREFIXES.some((prefix) => path.startsWith(prefix))) return path;
  if (USERNAME.test(path)) return `/user${path}`;

  return fallback;
}
