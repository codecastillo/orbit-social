import type { MetadataRoute } from "next";

// Static public routes only. Dynamic entities (posts, profiles, communities,
// events, listings, clips) stay out: enumerating them would put a heavy query
// on every sitemap request, and crawlers reach them through internal links
// from the index pages listed here.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const routes = [
    "",
    "/feed",
    "/explore",
    "/explore/trending",
    "/clips",
    "/live",
    "/communities",
    "/events",
    "/marketplace",
    "/promises",
    "/terms",
    "/privacy",
    "/signup",
    "/login",
  ];
  return routes.map((route) => ({
    url: `${base}${route}`,
    changeFrequency: route === "" ? "weekly" : "daily",
    priority: route === "" ? 1 : 0.7,
  }));
}
