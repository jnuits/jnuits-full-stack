import {beforeEach,expect,it,vi}from"vitest";
const m=vi.hoisted(()=>({permission:vi.fn(),actor:vi.fn(),rpc:vi.fn(),has:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/session",()=>({requireAdminPermission:m.permission,requireAdminUser:vi.fn(),hasPermission:m.has}));
vi.mock("@/lib/auth/admin-verification/actor",()=>({loadAdminVerificationActor:m.actor}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({rpc:m.rpc})}));
import{loadAdminActivity,loadAdminAccountabilitySummary,activityItemsToCsv}from"./query";
import type {ActivityItem}from"@/components/admin/admin-activity-panel";
const actor={userId:"9469b123-33aa-44ee-aaaa-222222222222",sessionId:"9469b123-33aa-44ee-aaaa-333333333333",currentLevel:"aal1",enforced:false};
beforeEach(()=>{vi.clearAllMocks();m.permission.mockResolvedValue({});m.actor.mockResolvedValue({ok:true,value:actor});m.has.mockResolvedValue(false);m.rpc.mockResolvedValue({data:{items:[],page:1,pageSize:25,totalItems:0,coverage:{state:"unavailable",observedSince:null,lastCollectedAt:null,message:"Coverage not verified"}},error:null});});
it("requires audit permission and live native assurance immediately before bounded reads",async()=>{
 await loadAdminActivity({page:9,pageSize:1000});
 expect(m.permission).toHaveBeenCalledWith("admin.audit.read",{fallbackPath:"/admin/dashboard"});
 expect(m.rpc).toHaveBeenCalledWith("query_admin_activity",expect.objectContaining({p_actor:actor,p_filters:expect.objectContaining({page:9,pageSize:100}),p_full_network_id:null}));
});
it("never reads on permission denial or pending enforced assurance",async()=>{
 m.permission.mockRejectedValueOnce(new Error("denied"));await expect(loadAdminActivity({})).rejects.toThrow("denied");expect(m.rpc).not.toHaveBeenCalled();
 m.actor.mockResolvedValue({ok:true,value:{...actor,enforced:true}});await expect(loadAdminActivity({})).rejects.toThrow("Verified admin session required");expect(m.rpc).not.toHaveBeenCalled();
});
it("full network lookup requires both audit and security permissions",async()=>{
 await expect(loadAdminActivity({networkId:"9469b123-33aa-44ee-aaaa-111111111111"})).rejects.toThrow("Network details unavailable");expect(m.rpc).not.toHaveBeenCalled();
 m.has.mockResolvedValue(true);await loadAdminActivity({networkId:"9469b123-33aa-44ee-aaaa-111111111111"});expect(m.rpc.mock.calls[0][1].p_full_network_id).toBe("9469b123-33aa-44ee-aaaa-111111111111");
});
it("rejects malformed filters instead of broadening access",async()=>{
 await expect(loadAdminActivity({actor:"not-uuid"})).rejects.toThrow("Invalid activity filters");expect(m.rpc).not.toHaveBeenCalled();
});
it("cannot read another admin summary without existing management visibility",async()=>{
 await expect(loadAdminAccountabilitySummary("9469b123-33aa-44ee-aaaa-111111111111")).rejects.toThrow("Account activity unavailable");expect(m.rpc).not.toHaveBeenCalled();
});
it("neutralizes spreadsheet formulas after leading whitespace while omitting network details",()=>{
 const row={occurredAt:"2026-10-15T04:00:00Z",recordedAt:"2026-10-15T04:00:00Z",actorLabel:"\t=HYPERLINK(\"bad\")",targetLabel:"Fixture",actionLabel:"fixture.work",outcome:"succeeded",sourceLabel:"application_commit",provenanceLabel:"Committed",context:{ipDisplay:"198.51.100.1"}}as ActivityItem;
 const csv=activityItemsToCsv([row]);expect(csv).toContain('"\'\t=HYPERLINK');expect(csv).not.toContain("198.51.100.1");
});
