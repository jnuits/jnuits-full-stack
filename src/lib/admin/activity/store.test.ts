import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({rpc:m.rpc})}));
import {appendTrustedAdminActivity} from "./store";
const event={id:"9469b123-33aa-44ee-aaaa-111111111111",source:"workspace_entry" as const,sourceId:"native-session",actorUserId:"9469b123-33aa-44ee-aaaa-222222222222",targetUserId:null,action:"workspace.entry",outcome:"succeeded" as const,occurredAt:"2026-10-15T04:00:00Z",recordedAt:"2026-10-15T04:00:00Z",context:null,provenance:"verified native workspace entry"};
beforeEach(()=>vi.resetAllMocks());
it("passes the validated event and native session to the service-only receipt boundary",async()=>{
 m.rpc.mockResolvedValue({data:"stored",error:null});
 expect(await appendTrustedAdminActivity(event,"9469b123-33aa-44ee-aaaa-333333333333")).toBe("stored");
 expect(m.rpc).toHaveBeenCalledWith("append_admin_activity",{p_event:event,p_session_id:"9469b123-33aa-44ee-aaaa-333333333333"});
});
it("preserves duplicate receipts without retrying business work",async()=>{
 m.rpc.mockResolvedValue({data:"duplicate",error:null});
 expect(await appendTrustedAdminActivity(event,"9469b123-33aa-44ee-aaaa-333333333333")).toBe("duplicate");
 expect(m.rpc).toHaveBeenCalledTimes(1);
});
it("rejects unknown fields and caller-selected outcomes before persistence",async()=>{
 await expect(Reflect.apply(appendTrustedAdminActivity,null,[{...event,password:"secret"},"session"])).rejects.toThrow();
 expect(m.rpc).not.toHaveBeenCalled();
});
it("does not claim success on a storage failure or malformed receipt",async()=>{
 m.rpc.mockResolvedValueOnce({data:null,error:{code:"42501"}});
 await expect(appendTrustedAdminActivity(event,"session")).rejects.toThrow("Activity receipt could not be stored");
 m.rpc.mockResolvedValueOnce({data:"ignored",error:null});
 await expect(appendTrustedAdminActivity(event,"session")).rejects.toThrow("Activity receipt could not be stored");
});
