import {beforeEach,expect,it,vi} from "vitest";
import {createAdminNotificationsFixture} from "./admin-notifications-fixture.mjs";
const email="qa-never-aabbcc@local.invalid";
const account={email,userId:"9469b123-33aa-44ee-aaaa-222222222222"};
const valid={dbContainer:"supabase_db_jnuits-admin-qa-aabbcc",appBaseUrl:"http://127.0.0.1:3127",accounts:new Map([["never",account]]),sql:vi.fn(),jsonSql:vi.fn(),uuid:value=>value,totp:vi.fn(),cronSecret:"synthetic-cron",webhookSecret:"whsec_c3ludGhldGlj"};
beforeEach(()=>vi.clearAllMocks());
it("refuses production or foreign fixture targets before any data access",()=>{
 expect(()=>createAdminNotificationsFixture({...valid,dbContainer:"supabase_db_existing"})).toThrow();
 expect(()=>createAdminNotificationsFixture({...valid,appBaseUrl:"https://jnuits.org.bd"})).toThrow();expect(valid.sql).not.toHaveBeenCalled();
});
it("records a single synthetic provider acceptance for stable-key retries and refuses payload drift",async()=>{
 const fixture=createAdminNotificationsFixture(valid);
 const body={to:email,from:"JnUITS <no-reply@jnuits.org.bd>",replyTo:"no-reply@jnuits.org.bd",subject:"Notice",html:"<p>Notice</p>",text:"Notice",idempotencyKey:"jnuits-admin/fixture"};
 const first=await fixture.handle("notice_transport",body),again=await fixture.handle("notice_transport",body);
 expect(first.value.id).toBe(again.value.id);await expect(fixture.handle("notice_transport",{...body,text:"Changed"})).rejects.toThrow();
 await expect(fixture.handle("notice_transport",{...body,to:"real@example.test"})).rejects.toThrow();
});
it("rejects unknown commands instead of exposing a generic SQL bridge",async()=>{
 await expect(createAdminNotificationsFixture(valid).handle("notice_sql",{sql:"select 1"})).rejects.toThrow();expect(valid.sql).not.toHaveBeenCalled();
});
it("refreshes only the notification suite's known admin fixtures, preserving earlier portal password mutations",async()=>{
 const session={auth:{signInWithPassword:vi.fn().mockResolvedValue({error:null}),getClaims:vi.fn().mockResolvedValue({data:{claims:{role:"authenticated",session_id:account.userId}}})}};
 const fixtures=new Map(["never","super","setup","activityreader","completionadmin","noticeactor"].map(name=>[name,{...account,session}]));
 const portalSignIn=vi.fn().mockRejectedValue(new Error("Earlier portal password changed"));
 fixtures.set("profile",{...account,session:{auth:{signInWithPassword:portalSignIn}}});
 await expect(createAdminNotificationsFixture({...valid,accounts:fixtures}).handle("notice_reset")).resolves.toMatchObject({value:{ok:true}});
 expect(portalSignIn).not.toHaveBeenCalled();expect(session.auth.signInWithPassword).toHaveBeenCalledTimes(6);
 expect(valid.sql).toHaveBeenCalledWith(expect.stringContaining("delete from private.admin_verification_rate_events;"));
});
