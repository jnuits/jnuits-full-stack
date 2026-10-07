import "server-only";
import { createPublicClient } from "@/lib/supabase/public";

export type PublicContentSitemapEntry = { path: string; updatedAt?: string };
const PAGE_SIZE = 500;

function canonicalPath(prefix: string, slug: unknown): string | null {
  if (typeof slug !== "string" || !/^[\p{L}\p{M}\p{N}_-]+$/u.test(slug)) return null;
  return prefix + "/" + encodeURIComponent(slug);
}

function modificationDate(...values: (string | null | undefined)[]): string | undefined {
  for (const value of values) {
    if (value && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  }
}

/** Public clients enforce publication RLS; no bodies or contributor identities are fetched. */
export async function getPublicContentSitemapEntries(): Promise<PublicContentSitemapEntry[]> {
  const client = createPublicClient();
  const entries = new Map<string, PublicContentSitemapEntry>();
  const add = (path: string | null, updatedAt: string | undefined) => {
    if (path && !entries.has(path)) entries.set(path, { path, ...(updatedAt ? { updatedAt } : {}) });
  };
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.from("content_posts")
      .select("id, slug, content_type, updated_at, published_at, created_at")
      .in("content_type", ["blog", "notice"]).eq("status", "published")
      .order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error || !data) throw new Error("Sitemap content could not be loaded.");
    for (const row of data) {
      add(canonicalPath(row.content_type === "blog" ? "/blogs" : "/notices", row.slug),
        modificationDate(row.updated_at, row.published_at, row.created_at));
    }
    if (data.length < PAGE_SIZE) break;
  }
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.from("projects")
      .select("id, slug, updated_at, created_at").neq("status", "archived")
      .order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error || !data) throw new Error("Sitemap content could not be loaded.");
    for (const row of data) add(canonicalPath("/projects", row.slug), modificationDate(row.updated_at, row.created_at));
    if (data.length < PAGE_SIZE) break;
  }
  return [...entries.values()];
}
