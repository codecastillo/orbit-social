import type { MetadataRoute } from "next";

// Public surfaces (feed, profiles, posts, hashtags, clips, live, rooms,
// events, marketplace) stay crawlable; only the auth-required prefixes from
// the middleware deny-list plus admin and API routes are blocked.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/notifications",
        "/messages",
        "/bookmarks",
        "/drafts",
        "/scheduled",
        "/settings",
        "/onboarding",
        "/admin",
        "/api/",
      ],
    },
    ...(siteUrl ? { sitemap: `${siteUrl}/sitemap.xml` } : {}),
  };
}
