import {NextRequest} from "next/server";
import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({load:vi.fn(),mark:vi.fn(),prefs:vi.fn(),save:vi.fn(),auth:vi.fn()}));
vi.mock("@/lib/admin/notifications/store",()=>({loadOwnAdminNotices:m.load,markOwnNoticeRead:m.mark,loadOwnAdminEmailPreferences:m.prefs,saveOwnAdminEmailPreferences:m.save}));
vi.mock("@/lib/auth/session",()=>({getAuthContext:m.auth}));
vi.mock("@/lib/security/rate-limit",()=>({getRequestIp:()=>"fixture",checkRateLimitForApi:async()=>({success:true,remaining:10,resetAt:Date.now()+60000})}));
import {GET,POST} from "./route";
const context={params:Promise.resolve({})};
const request=(body:unknown,origin="https://jnuits.example.test")=>new NextRequest("https://jnuits.example.test/api/admin/notifications",{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({user:{id:"fixture"}});m.load.mockResolvedValue({items:[],totalItems:0,page:1,pageSize:25,unreadCount:0});m.mark.mockResolvedValue(undefined);m.prefs.mockResolvedValue({admin_security_email_opt_in:false,admin_recommendation_email_opt_in:false});m.save.mockResolvedValue({});});
it("protects private inbox and owned mutation responses from caching",async()=>{
 const get=await GET(new NextRequest("https://jnuits.example.test/api/admin/notifications?page=2"),context);expect(get.status).toBe(200);expect(get.headers.get("Cache-Control")).toContain("no-store");
 const post=await POST(request({action:"mark_read",noticeId:"9469b123-33aa-44ee-aaaa-111111111111"}),context);expect(post.status).toBe(200);expect(m.mark).toHaveBeenCalledWith("9469b123-33aa-44ee-aaaa-111111111111");
});
it("rejects cross-origin, missing auth and browser-selected recipients before mutation",async()=>{
 expect((await POST(request({action:"mark_all_read"},"https://evil.invalid"),context)).status).toBe(403);
 expect((await POST(request({action:"mark_all_read",userId:"other"}),context)).status).toBe(422);
 m.auth.mockResolvedValue({user:null});expect((await POST(request({action:"mark_all_read"}),context)).status).toBe(401);
 expect(m.mark).not.toHaveBeenCalled();
});
it("saves only strict optional preferences and never accepts a recipient",async()=>{
 const preferences={admin_security_email_opt_in:true,admin_recommendation_email_opt_in:false};
 expect((await POST(request({action:"preferences",preferences}),context)).status).toBe(200);expect(m.save).toHaveBeenCalledWith(preferences);
 expect((await POST(request({action:"preferences",preferences:{...preferences,userId:"other"}}),context)).status).toBe(422);
});
it("returns stable unavailable responses without database details",async()=>{
 m.load.mockRejectedValue(new Error("private SQL error"));const r=await GET(new NextRequest("https://jnuits.example.test/api/admin/notifications"),context);expect(r.status).toBe(503);expect(await r.text()).not.toContain("SQL");
});
