import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], requests: [] as { select: string; start?: number; end?: number; head?: boolean }[] }));
function query() {
  const filters: [string, unknown][] = [];
  let searchPattern: RegExp | undefined;
  const request = { select: "", start: undefined as number|undefined, end: undefined as number|undefined, head: false };
  state.requests.push(request);
  const builder = {
    select(value: string, options?: { head?: boolean }) { request.select = value; request.head = Boolean(options?.head); return builder; },
    eq(field: string, value: unknown) { filters.push([field,value]); return builder; },
    ilike(field: string, value: string) { filters.push([field,value.toLowerCase()]); return builder; },
    or(value: string) {
      const quoted = value.match(/^slug\.ilike\."((?:\\.|[^"\\])*)"/);
      if (!quoted) throw new Error("Unexpected test OR filter.");
      const sqlPattern = quoted[1].replace(/\\(.)/g, "$1");
      let regex = "^";
      for (let index=0; index<sqlPattern.length; index++) {
        const char=sqlPattern[index];
        if(char==="\\") regex+=sqlPattern[++index]?.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") || "";
        else if(char==="%") regex+=".*";
        else if(char==="_") regex+=".";
        else regex+=char.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      }
      searchPattern=new RegExp(regex+"$","i");return builder;
    },
    order() { return builder; },
    range(start: number,end: number) { request.start=start;request.end=end;return builder; },
    then(resolve: (value: unknown) => unknown) {
      const rows = state.rows.filter(row => (!searchPattern || searchPattern.test(String(row.title))) && filters.every(([field,value]) => String(row[field]).toLowerCase() === String(value).toLowerCase()));
      return Promise.resolve({ data: request.head ? null : rows.slice(request.start ?? 0, request.end === undefined ? undefined : request.end+1), count: rows.length, error: (request.start || 0)>2147483647 ? { message: "Offset outside PostgreSQL integer range" } : null }).then(resolve);
    },
  };
  return builder;
}
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ from: query, rpc: async () => ({ data: [...new Set(state.rows.filter(row => row.content_type === "blog" && row.status === "published").map(row => row.category))].sort(), error: null }) }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: query, rpc: async () => ({ data: { categories: ["News","Tutorial"], metrics: { total: 30, published: 25, drafts: 3, archived: 2 } }, error: null }),
}) }));
import { getPublishedBlogArchive } from "./public-content";
import { getAdminNoticesDashboard } from "./notices";

function rows(type: string, length: number) {
  return Array.from({ length }, (_,i) => ({
    id: String(i+1), slug: "entry-"+(i+1), title: "Entry "+(i+1), content_type: type,
    category: i<25 ? "Tutorial" : "News", status: "published", summary: "Summary",
    excerpt: "Excerpt", body: "Private large body", published_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    cta_href: null, read_time: null, media_assets: null, author_profile: null,
  }));
}
beforeEach(() => { state.requests = []; });
describe("bounded content archives", () => {
  it("keeps percent, underscore and backslash searches literal through PostgREST quoting", async () => {
    state.rows = [
      {...rows("notice",1)[0],title:"literal 100%_done\\path"},
      {...rows("notice",1)[0],id:"2",title:"literal 100ABCDEdonepath"},
    ];
    const result = await getAdminNoticesDashboard({query:"100%_done\\path"});
    expect(result.totalItems).toBe(1);
    expect(result.items.map(item=>item.title)).toEqual(["literal 100%_done\\path"]);
  });
  it("makes posts beyond24 reachable and filters category before pagination", async () => {
    state.rows = rows("blog", 40);
    const result = await getPublishedBlogArchive({ page: 2, category: "Tutorial" });
    expect(result).toMatchObject({ page: 2, pageSize: 24, totalItems: 25, totalPages: 2, categories: ["News","Tutorial"] });
    expect(result.items.map(item => item.slug)).toEqual(["entry-25"]);
    expect(state.requests.filter(request => !request.head && request.select !== "category")).toEqual([expect.objectContaining({ start: 24, end: 47 })]);
    expect(state.requests[0].select).not.toMatch(/(?:^|,\s*)body(?:,|$)/);
  });
  it("normalizes invalid pages and clamps an excessive page", async () => {
    state.rows = rows("blog", 40);
    expect((await getPublishedBlogArchive({ page: -2 })).page).toBe(1);
    const result = await getPublishedBlogArchive({ page: 999 });
    expect(result.page).toBe(2); expect(result.items).toHaveLength(16);
    expect(state.requests.at(-1)).toMatchObject({ start: 24, end: 47 });
  });
  it("clamps safe-integer pages before database offset arithmetic", async () => {
    state.rows = rows("blog",40);
    expect((await getPublishedBlogArchive({page: Number.MAX_SAFE_INTEGER})).page).toBe(2);
    state.rows = rows("notice",30);
    expect((await getAdminNoticesDashboard({page: Number.MAX_SAFE_INTEGER})).page).toBe(3);
    expect(state.requests.every(request => (request.end || 0)<100)).toBe(true);
  });
  it("uses published eligibility and fallback pagination for an empty database", async () => {
    state.rows = [{ ...rows("blog", 1)[0], status: "draft" }];
    const result = await getPublishedBlogArchive({ page: 999 });
    expect(result.page).toBe(1); expect(result.items.length).toBeGreaterThan(0);
    expect(result.items).not.toContainEqual(expect.objectContaining({ slug: "entry-1" }));
  });
  it("fetches only12 notice bodies while global summaries stay database-derived", async () => {
    state.rows = rows("notice", 30).map((row,i) => ({ ...row, status: i<25 ? "published" : i<28 ? "draft" : "archived" }));
    const result = await getAdminNoticesDashboard({ page: 2, category: "Tutorial" });
    expect(result).toMatchObject({ page: 2, totalItems: 25, totalPages: 3, metrics: { total: 30, published: 25, drafts: 3, archived: 2 }, categories: ["News","Tutorial"] });
    expect(result.items).toHaveLength(12);
    const bodyRequests = state.requests.filter(request => !request.head && request.select.includes("body"));
    expect(bodyRequests).toEqual([expect.objectContaining({ start: 12, end: 23 })]);
  });
});
