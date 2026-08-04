import { toMobilePath } from "@/lib/deep-links";

/**
 * Rewrites incoming universal links (https://orbitsocial.net/...) into app
 * routes before Expo Router matches them, so the web URL shapes and the app
 * file tree do not have to agree.
 */

// Matches the associated domains declared in app.json. Group 1 is the path,
// group 2 the query string.
const WEB_URL = /^https:\/\/(?:www\.)?orbitsocial\.net(\/[^?#]*)?(\?[^#]*)?/i;

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const match = WEB_URL.exec(path);
    // Custom-scheme links (orbitmobile://) already name app routes.
    if (!match) return path;

    const webPath = `${match[1] ?? "/"}${match[2] ?? ""}`;
    // Three slashes: an empty host, so the first route segment is not parsed
    // as one.
    return `orbitmobile://${toMobilePath(webPath, "/(tabs)")}`;
  } catch {
    // A throw here crashes the launch, and an unrouted link is the smaller
    // failure.
    return path;
  }
}
