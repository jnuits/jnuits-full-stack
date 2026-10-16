import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({permission:vi.fn(),actor:vi.fn(),rpc:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/session",()=>({requireAdminPermission:m.permission}));
vi.mock("@/lib/auth/admin-verification/actor",()=>({loadAdminVerificationActor:m.actor}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({rpc:m.rpc})}));
import {loadOwnAdminNotices,markOwnNoticeRead,loadOwnAdminEmailPreferences,saveOwnAdminEmailPreferences,loadOwnAdminNotificationHealth} from "./store";
const actor={userId:"9469b123-33aa-44ee-aaaa-222222222222",sessionId:"9469b123-33aa-44ee-aaaa-333333333333",currentLevel:"aal1",enforced:false};
beforeEach(()=>{vi.clearAllMocks();m.permission.mockResolvedValue({});m.actor.mockResolvedValue({ok:true,value:actor});m.rpc.mockResolvedValue({data:{items:[],page:1,pageSize:25,totalItems:0,unreadCount:0},error:null});});
it("bounds own inbox and delegates recipient identity to the verified session",async()=>{
 await loadOwnAdminNotices({page:8,pageSize:1000});
 expect(m.permission).toHaveBeenCalledWith("admin.audit.read",{fallbackPath:"/admin/dashboard"});
 expect(m.rpc).toHaveBeenCalledWith("query_own_admin_notices",{p_actor:actor,p_page:8,p_page_size:100});
});
it("denies before data access for missing permission or enforced AAL1",async()=>{
 m.permission.mockRejectedValueOnce(new Error("denied"));await expect(loadOwnAdminNotices({})).rejects.toThrow();expect(m.rpc).not.toHaveBeenCalled();
 m.actor.mockResolvedValue({ok:true,value:{...actor,enforced:true}});await expect(loadOwnAdminNotices({})).rejects.toThrow();expect(m.rpc).not.toHaveBeenCalled();
});
it("marks only a validated notice id under the caller's identity",async()=>{
 await expect(markOwnNoticeRead("not-uuid")).rejects.toThrow();expect(m.rpc).not.toHaveBeenCalled();
 m.rpc.mockResolvedValue({data:true,error:null});await markOwnNoticeRead("9469b123-33aa-44ee-aaaa-111111111111");
 expect(m.rpc).toHaveBeenCalledWith("mark_own_admin_notice_read",{p_actor:actor,p_notice_id:"9469b123-33aa-44ee-aaaa-111111111111"});
});
it("fails closed for unavailable or malformed inbox data",async()=>{
 m.rpc.mockResolvedValue({data:{},error:null});await expect(loadOwnAdminNotices({})).rejects.toThrow("Notice inbox unavailable");
});
it("self-owned optional preferences do not require global settings permission",async()=>{
 m.rpc.mockResolvedValue({data:{admin_security_email_opt_in:false,admin_recommendation_email_opt_in:false},error:null});
 expect(await loadOwnAdminEmailPreferences()).toEqual({admin_security_email_opt_in:false,admin_recommendation_email_opt_in:false});
 await saveOwnAdminEmailPreferences({admin_security_email_opt_in:true,admin_recommendation_email_opt_in:false});
 expect(m.permission).not.toHaveBeenCalled();
 expect(m.rpc).toHaveBeenLastCalledWith("own_admin_email_preferences",{p_actor:actor,p_preferences:{admin_security_email_opt_in:true,admin_recommendation_email_opt_in:false}});
});
it("rejects client-selected recipients and non-boolean preferences",async()=>{
 await expect(saveOwnAdminEmailPreferences({admin_security_email_opt_in:true,admin_recommendation_email_opt_in:false,userId:"other"}as never)).rejects.toThrow();
 expect(m.rpc).not.toHaveBeenCalled();
});
it("loads only permission-checked safe job health and fails unavailable instead of claiming success",async()=>{
 const value={state:"attention",lastFinishedAt:"2026-10-16T04:00:00Z",lastSuccessfulAt:null,backlog:true,operatorAttentionCount:1};
 m.rpc.mockResolvedValue({data:value,error:null});expect(await loadOwnAdminNotificationHealth()).toEqual(value);
 expect(m.rpc).toHaveBeenCalledWith("query_admin_accountability_health",{p_actor:actor});
 m.permission.mockRejectedValueOnce(new Error("denied"));m.rpc.mockClear();await expect(loadOwnAdminNotificationHealth()).rejects.toThrow();expect(m.rpc).not.toHaveBeenCalled();
 m.rpc.mockResolvedValue({data:{state:"current"},error:null});await expect(loadOwnAdminNotificationHealth()).rejects.toThrow();
});
