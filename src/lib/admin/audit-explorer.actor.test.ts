import {createClient} from "@supabase/supabase-js";
import {beforeEach,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({client:null as unknown,allowed:true,queries:[] as URL[]}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>state.client}));
vi.mock("@/lib/auth/session",()=>({requireAdminPermission:async(p:string)=>{if(p!=="admin.audit.read"||!state.allowed)throw new Error("Audit denied");}}));
import {loadAuditExplorerData,parseAuditFilters} from "./audit-explorer";
const actor="11111111-1111-4111-8111-111111111111";
beforeEach(()=>{
 state.allowed=true; state.queries=[];
 state.client=createClient("https://fixture.supabase.co","fixture-key",{auth:{persistSession:false},global:{fetch:async input=>{
  const url=new URL(String(input));state.queries.push(url);
  if(url.pathname.endsWith("/admin_profiles")) return url.searchParams.get("select") === "user_id,display_name" ? Response.json([{user_id:actor,display_name:"Fixture Operator"}]) : Response.json({code:"42703",message:"Missing column"},{status:400});
  return Response.json([{id:"event",action:"fixture.changed",actor_user_id:actor,entity_type:"fixture",entity_id:"record",created_at:"2026-01-01T00:00:00Z",metadata:{}}],{headers:{"content-range":"0-0/1"}});
 }}});
});
it("adds bounded minimal authorized actor labels, without account/member rows",async()=>{
 const result=await loadAuditExplorerData(parseAuditFilters({actor}));
 expect(result.actorOptions).toContainEqual({userId:actor,label:"Fixture Operator"});
 const labels=state.queries.find(q=>q.pathname.endsWith("/admin_profiles"))!;
 expect(labels.searchParams.get("select")).toBe("user_id,display_name");expect(labels.searchParams.get("limit")).toBe("100");expect(labels.searchParams.get("user_id")).toContain(actor);
 expect(state.queries.every(q=>q.pathname.endsWith("/audit_events")||q.pathname.endsWith("/admin_profiles"))).toBe(true);
 expect(state.queries[0].searchParams.get("actor_user_id")).toBe(`eq.${actor}`);
});
it("preserves an unknown actor's exact filter and supplies a custom label",async()=>{
 const custom="22222222-2222-4222-8222-222222222222";
 const result=await loadAuditExplorerData(parseAuditFilters({actor:custom,q:"record",action:"fixture",entityType:"fixture",from:"2026-01-01",to:"2026-01-02"}));
 expect(result.actorOptions).toContainEqual({userId:custom,label:"Custom actor"});
 expect(state.queries[0].searchParams.get("actor_user_id")).toBe(`eq.${custom}`);
});
it("keeps export filters and skips unnecessary actor directory queries",async()=>{
 await loadAuditExplorerData(parseAuditFilters({actor,entityType:"fixture",action:"changed",q:"record"}),{exportMode:true});
 expect(state.queries[0].searchParams.get("actor_user_id")).toBe(`eq.${actor}`); expect(state.queries[0].searchParams.get("entity_type")).toBe("eq.fixture");
 expect(state.queries.some(q=>q.pathname.endsWith("/admin_profiles"))).toBe(false);
});
it("denies a caller before all audit and label reads",async()=>{
 state.allowed=false; await expect(loadAuditExplorerData(parseAuditFilters({}))).rejects.toThrow("Audit denied");expect(state.queries).toEqual([]);
});
