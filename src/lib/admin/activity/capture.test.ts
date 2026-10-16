import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({append:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("./store",()=>({appendTrustedAdminActivity:m.append}));
import {recordAdminWorkspaceEntry,recordAdminPageAccess,recordAdminSignIn} from "./capture";
import type {AdminVerificationActor} from "@/lib/auth/admin-verification/types";
const actor:AdminVerificationActor={userId:"9469b123-33aa-44ee-aaaa-222222222222",sessionId:"9469b123-33aa-44ee-aaaa-333333333333",email:"private@local.invalid",emailConfirmed:true,roleVersion:1,currentLevel:"aal1",enforced:false,enrollment:"unknown"};
const now=new Date("2026-10-15T04:00:00Z");
beforeEach(()=>{vi.clearAllMocks();m.append.mockResolvedValue("stored")});
it("records exact session entry and one stable UTC-day access key without secrets",async()=>{
 const headers=new Headers({"x-jnuits-return-to":"/admin","user-agent":"Chrome/140.0"});
 await recordAdminWorkspaceEntry(actor,headers,now); await recordAdminPageAccess(actor,headers,now);
 expect(m.append.mock.calls[0][0]).toMatchObject({source:"workspace_entry",sourceId:"session:"+actor.sessionId,action:"workspace.entry",outcome:"succeeded"});
 expect(m.append.mock.calls[1][0]).toMatchObject({source:"workspace_access",sourceId:"access:"+actor.userId+":2026-10-15"});
 expect(JSON.stringify(m.append.mock.calls)).not.toContain(actor.email);
});
it.each([{"next-router-prefetch":"1"},{purpose:"prefetch"},{"sec-purpose":"prefetch"},{"x-jnuits-return-to":"/api/admin/export"},{"x-jnuits-return-to":"/admin/mfa/challenge"}])("does not record prefetch/background/MFA entry %j",async extra=>{
 const headers=new Headers({"x-jnuits-return-to":"/admin"});
 for(const [name,value]of Object.entries(extra))if(typeof value==="string")headers.set(name,value);
 await recordAdminWorkspaceEntry(actor,headers,now);await recordAdminPageAccess(actor,headers,now);
 expect(m.append).not.toHaveBeenCalled();
});
it("does not turn pending enforced MFA into workspace access",async()=>{
 await recordAdminWorkspaceEntry({...actor,enforced:true},new Headers({"x-jnuits-return-to":"/admin"}),now);
 expect(m.append).not.toHaveBeenCalled();
});
it("keeps real admin sign-in distinct from subsequent workspace access",async()=>{
 await recordAdminSignIn({...actor,enforced:true},now);
 expect(m.append.mock.calls[0][0]).toMatchObject({source:"admin_signin",action:"admin.signin",sourceId:"signin:"+actor.sessionId});
});
