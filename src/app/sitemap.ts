import type { MetadataRoute } from "next";
import { publicNavigation } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://jnuits.org.bd";
  const extraRoutes = [
    "/committee/advisory",
    "/committee/5th",
  ];
  const routes = Array.from(
    new Set([...publicNavigation.map((item) => item.href), ...extraRoutes])
  );

  return routes.map((href) => ({
    url: `${baseUrl}${href}`,
    lastModified: new Date(),
    changeFrequency: href === "/" ? "weekly" : "monthly",
    priority: href === "/" ? 1 : 0.7,
  }));
}
