import type { MetadataRoute } from "next";
import { getPublishedGallerySitemapEntries } from "@/lib/content/gallery";
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
    lastModified: new Date(),
    changeFrequency: href === "/" ? "weekly" as const : "monthly" as const,
    priority: href === "/" ? 1 : 0.7,
  }));
  const galleryRoutes = (await getPublishedGallerySitemapEntries()).map((album) => ({
    url: `${baseUrl}/gallery/${album.slug}`,
    lastModified: new Date(album.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.65,
  }));

  return [...staticRoutes, ...galleryRoutes];
}
