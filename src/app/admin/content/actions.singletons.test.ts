import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ client: null as unknown, allowed: true, writes: [] as Array<Record<string, unknown>>, flashes: [] as Array<{tone: string}> }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => state.client }));
vi.mock("@/lib/auth/session", () => ({ requireAdminPermission: async (permission: string) => {
  if (permission !== "cms.pages.manage" || !state.allowed) throw new Error("Project permission denied");
  return { user: { id: "11111111-1111-4111-8111-111111111111" }, roles: ["content_admin"] };
} }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`Redirect ${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: async (flash: {tone: string}) => { state.flashes.push(flash); } }));
vi.mock("@/lib/content/media-assets", () => ({ insertAuditEvent: vi.fn(), upsertCloudinaryMediaAsset: vi.fn() }));
import { saveContentPage } from "./actions";
import { insertAuditEvent } from "@/lib/content/media-assets";
const revision="2026-01-01T00:00:00Z";
let current: null | Record<string, unknown>;
let conflict=false;
let calls: Array<{url:URL; method:string}> = [];
function data(values: Record<string, string> = {}) {
 const f=new FormData(); Object.entries({slug:"home",title:"Home",status:"published",bodyJson:'{"aboutSection":{"title":"Updated"}}',expectedUpdatedAt:revision,...values}).forEach(([k,v])=>f.set(k,v)); return f;
}
describe("singleton persistence", () => {
 beforeEach(() => {
  vi.clearAllMocks(); state.allowed=true; state.writes=[]; state.flashes=[]; conflict=false; calls=[];
  current={id:"fixture-page",slug:"home",updated_at:revision,body:{stats:[1],aboutSection:{title:"Old",future:true}},created_by_user_id:"original"};
  state.client=createClient("https://fixture.supabase.co","fixture-key",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
   const url=new URL(String(input)); const method=init?.method || "GET"; calls.push({url,method});
   if(method === "GET") return Response.json(current);
   state.writes.push(JSON.parse(String(init?.body)));
   if(conflict) return method === "POST" ? Response.json({code:"23505",message:"Duplicate"},{status:409}) : Response.json(null);
   return Response.json({id:"fixture-page"});
  }}});
 });
 it("preserves server-owned content and creator with a revision-bound PATCH",async()=>{
  await expect(saveContentPage(data())).rejects.toThrow("Redirect");
  expect(state.flashes.at(-1)?.tone).toBe("success");
  expect(state.writes[0]).toMatchObject({body:{stats:[1],aboutSection:{title:"Updated",future:true}}});
  expect(state.writes[0]).not.toHaveProperty("created_by_user_id");
  const write=calls.find(c=>c.method==="PATCH")!; expect(write.url.searchParams.get("updated_at")).toBe(`eq.${revision}`);
  expect(insertAuditEvent).toHaveBeenCalledTimes(1);
 });
 it.each(["{", "null", "[]", '"text"'])("rejects malformed/nonobject JSON %s",async bodyJson=>{
  await expect(saveContentPage(data({bodyJson}))).rejects.toThrow("Redirect"); expect(state.writes).toEqual([]); expect(state.flashes.at(-1)?.tone).toBe("error"); expect(insertAuditEvent).not.toHaveBeenCalled();
 });
 it("rejects a stale editor before writing",async()=>{
  current!.updated_at="2026-01-02T00:00:00Z";
  await expect(saveContentPage(data())).rejects.toThrow("Redirect"); expect(state.writes).toEqual([]); expect(state.flashes.at(-1)?.tone).toBe("error");
 });
 it("fails closed when a concurrent save wins after the read",async()=>{
  conflict=true; await expect(saveContentPage(data())).rejects.toThrow("Redirect"); expect(state.flashes.at(-1)?.tone).toBe("error"); expect(insertAuditEvent).not.toHaveBeenCalled();
 });
 it("inserts a new singleton without an overwrite upsert",async()=>{
  current=null; await expect(saveContentPage(data({expectedUpdatedAt:""}))).rejects.toThrow("Redirect");
  expect(calls.find(c=>c.method==="POST")!.url.searchParams.has("on_conflict")).toBe(false); expect(state.flashes.at(-1)?.tone).toBe("success");
 });
 it("does not overwrite a raced new singleton",async()=>{
  current=null; conflict=true; await expect(saveContentPage(data({expectedUpdatedAt:""}))).rejects.toThrow("Redirect"); expect(state.flashes.at(-1)?.tone).toBe("error"); expect(insertAuditEvent).not.toHaveBeenCalled();
 });
 it("requires a loaded revision for an existing singleton",async()=>{
  await expect(saveContentPage(data({expectedUpdatedAt:""}))).rejects.toThrow("Redirect"); expect(state.writes).toEqual([]);
 });
 it("denies unauthorized callers before reading/writing",async()=>{
  state.allowed=false; await expect(saveContentPage(data())).rejects.toThrow("permission denied"); expect(calls).toEqual([]);
 });
});
