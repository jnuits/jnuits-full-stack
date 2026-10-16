import {expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({rpc:m.rpc})}));
import {normalizeNativeAuthEvent,ingestAdminAuthEvents} from "./auth-source";
const uid="9469b123-33aa-44ee-aaaa-222222222222";
const row={id:"9469b123-33aa-44ee-aaaa-111111111111",created_at:"2026-10-15T04:00:00Z",ip_address:"198.51.100.1",payload:{actor_id:uid,actor_username:"private@local.invalid",action:"user_updated_password",traits:{password:"forbidden"}}};
const interval={userId:uid,activeFrom:"2026-10-15T03:00:00Z",activeUntil:null};
it("uses only a provider's stable row ID and verified event-time admin interval",()=>{
 const e=normalizeNativeAuthEvent(row,interval,new Date("2026-10-15T05:00:00Z"));
 expect(e).toMatchObject({source:"native_auth",sourceId:row.id,action:"auth.user_updated_password",outcome:"succeeded",actorUserId:uid});
 expect(JSON.stringify(e)).not.toContain("private@local.invalid");expect(JSON.stringify(e)).not.toContain("forbidden");
});
it.each([null,{...interval,userId:"other"},{...interval,activeFrom:"2026-10-16T00:00:00Z"},{...interval,activeUntil:"2026-10-15T03:59:59Z"}])("keeps unknown or invalid historical identity unassigned %j",history=>{
 expect(normalizeNativeAuthEvent(row,history,new Date("2026-10-15T05:00:00Z"))).toBeNull();
});
it("never converts refresh, reauthentication or attempted MFA into completed work or login",()=>{
 for(const action of ["token_refreshed","user_reauthenticate_requested","verification_attempted"]){
  expect(normalizeNativeAuthEvent({...row,payload:{...row.payload,action}},interval,new Date("2026-10-15T05:00:00Z"))).toMatchObject({action:"auth."+action,outcome:"unknown"});
 }
});
it("rejects malformed provider rows without leaking raw payloads",()=>{
 expect(normalizeNativeAuthEvent({...row,payload:{actor_id:"bad",action:"login"}},interval,new Date())).toBeNull();
});
it("rejects a malformed collection receipt instead of claiming job success",async()=>{
 for(const data of [{},{read:501,stored:1,backlog:false,coverage:{state:"current"}},{read:1,stored:2,backlog:false,coverage:{state:"partial",observedSince:null,continuousSince:null,lastCollectedAt:null}}]){
  m.rpc.mockResolvedValueOnce({data,error:null});
  await expect(ingestAdminAuthEvents({leaseId:uid})).rejects.toThrow("Native activity collection unavailable");
 }
});
