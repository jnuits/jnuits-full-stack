import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ posts: [] as Record<string,unknown>[], projects: [] as Record<string,unknown>[], ranges: [] as [string,number,number][], fail: false }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({
  from(table: string) {
    let start=0,end=499;
    const conditions: ((row: Record<string,unknown>) => boolean)[]=[];
    const builder = {
      select: () => builder, order: () => builder,
      eq(field: string,value: unknown) { conditions.push(row => row[field]===value); return builder; },
      in(field: string,values: unknown[]) { conditions.push(row => values.includes(row[field])); return builder; },
      neq(field: string,value: unknown) { conditions.push(row => row[field]!==value); return builder; },
      range(a: number,b: number) { start=a;end=b;state.ranges.push([table,a,b]);return builder; },
      then(resolve: (result: unknown)=>unknown) {
        const rows=table==="projects"?state.projects:state.posts;
        return Promise.resolve({ data: rows.filter(row=>conditions.every(fn=>fn(row))).slice(start,end+1), error: state.fail ? {message:"Unavailable"} : null }).then(resolve);
      }
    }; return builder;
  }
}) }));
import { getPublicContentSitemapEntries } from "./sitemap-entries";
beforeEach(() => { state.posts=[];state.projects=[];state.ranges=[];state.fail=false; });
describe("public detail sitemap projection", () => {
  it("enumerates more than one database page without draft/private content", async () => {
    state.posts=Array.from({length:1102},(_,i)=>({id:String(i),slug:"article-"+i,content_type:i%2?"notice":"blog",status:"published",updated_at:"2026-01-02T00:00:00.000Z"}));
    state.posts.push({slug:"secret",content_type:"blog",status:"draft"});
    state.projects=[{slug:"live-project",status:"active",updated_at:"2026-01-03T00:00:00.000Z"},{slug:"old-project",status:"archived"}];
    const entries=await getPublicContentSitemapEntries();
    expect(entries).toHaveLength(1103);
    expect(entries).toContainEqual({path:"/blogs/article-1100",updatedAt:"2026-01-02T00:00:00.000Z"});
    expect(entries).toContainEqual({path:"/notices/article-1101",updatedAt:"2026-01-02T00:00:00.000Z"});
    expect(entries.some(entry=>entry.path.includes("secret")||entry.path.includes("old-project"))).toBe(false);
    expect(state.ranges.every(([,a,b])=>b-a===499)).toBe(true);
  });
  it("rejects unsafe paths, deduplicates canonical paths and omits invented timestamps", async () => {
    state.posts=["good","good","../bad","evil/route","x?y","x#y","%2froute",""].map(slug=>({slug,content_type:"blog",status:"published",updated_at:"not-a-date"}));
    state.projects=[{slug:"বাংলা",status:"completed",updated_at:"2026-01-03T00:00:00.000Z"}];
    const entries=await getPublicContentSitemapEntries();
    expect(entries).toEqual([{path:"/blogs/good"},{path:"/projects/"+encodeURIComponent("বাংলা"),updatedAt:"2026-01-03T00:00:00.000Z"}]);
  });
  it("publishes Bengali article URLs under the existing blogs detail route", async () => {
    state.posts=[{slug:"বাংলা-প্রযুক্তি",content_type:"blog",status:"published"}];
    expect(await getPublicContentSitemapEntries()).toEqual([
      {path:"/blogs/"+encodeURIComponent("বাংলা-প্রযুক্তি")}
    ]);
  });
  it("fails rather than returning an apparently complete partial sitemap", async () => {
    state.fail=true;
    await expect(getPublicContentSitemapEntries()).rejects.toThrow("Sitemap content could not be loaded");
  });
});
