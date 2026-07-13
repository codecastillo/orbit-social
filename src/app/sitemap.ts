import type { MetadataRoute } from "next";

// Static public routes only. Dynamic entries (posts, profiles, rooms) are a
// follow-up once content volume justifies them.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const routes = [
    "",
    "/feed",
    "/explore",
    "/clips",
    "/live",
    "/communities",
    "/events",
    "/marketplace",
    "/signup",
    "/login",
  ];
  return routes.map((route) => ({
    url: `${base}${route}`,
    changeFrequency: route === "" ? "weekly" : "daily",
    priority: route === "" ? 1 : 0.7,
  }));
}
