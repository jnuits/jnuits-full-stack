export const dynamic = "force-dynamic";

import type { MetadataRoute } from "next";
import { getPublishedGallerySitemapEntries } from "@/lib/content/gallery";
import { getPublishedEventSitemapEntries } from "@/lib/content/events";
import { getPublicContentSitemapEntries } from "@/lib/content/sitemap-entries";
import { publicNavigation } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://jnuits.org.bd";
  const extraRoutes = [
    "/committee/advisory",
    "/committee/5th",
  ];
  const routes = Array.from(
    new Set([...publicNavigation.map((item) => item.href), ...extraRoutes])
  );

  const staticRoutes: MetadataRoute.Sitemap = routes.map((href) => ({
    url: `${baseUrl}${href}`,
    changeFrequency: href === "/" ? "weekly" as const : "monthly" as const,
    priority: href === "/" ? 1 : 0.7,
  }));
  const [galleryRoutes, eventRoutes, contentRoutes] = await Promise.all([
    getPublishedGallerySitemapEntries(),
    getPublishedEventSitemapEntries(),
    getPublicContentSitemapEntries(),
  ]);

  const entries: MetadataRoute.Sitemap = [
    ...staticRoutes,
    ...contentRoutes.map((entry) => ({ url: baseUrl + entry.path, ...(entry.updatedAt ? {lastModified: new Date(entry.updatedAt)} : {}), changeFrequency: "weekly" as const, priority: 0.7 })),
    ...galleryRoutes.map((album) => ({
      url: `${baseUrl}/gallery/${album.slug}`,
      lastModified: new Date(album.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })),
    ...eventRoutes.map((event) => ({
      url: `${baseUrl}/events/${event.slug}`,
      lastModified: new Date(event.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.72,
    })),
  ];
  return [...new Map(entries.map(entry => [entry.url, entry])).values()];
}
