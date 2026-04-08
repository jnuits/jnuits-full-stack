import type { MetadataRoute } from "next";
import { publicNavigation } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://jnuits.org.bd";
  const extraRoutes = ["/membership-form"];

  return [...publicNavigation.map((item) => item.href), ...extraRoutes].map((href) => ({
    url: `${baseUrl}${href}`,
    lastModified: new Date(),
    changeFrequency: href === "/" ? "weekly" : "monthly",
    priority: href === "/" ? 1 : 0.7,
  }));
}
