import {describe,expect,it} from "vitest";
import {adminActivityEventSchema} from "./model";
const event={id:"11111111-1111-4111-8111-111111111111",source:"workspace_entry",sourceId:"session:22222222-2222-4222-8222-222222222222",actorUserId:"33333333-3333-4333-8333-333333333333",targetUserId:null,action:"admin.workspace_entry",outcome:"succeeded",occurredAt:"2026-10-15T03:00:00Z",recordedAt:"2026-10-15T03:00:01Z",context:null,provenance:"Native live-session receipt"};
describe("trusted activity envelope",()=>{
 it("preserves stable source identities and truthful outcomes",()=>expect(adminActivityEventSchema.parse(event)).toEqual(event));
 it.each(["rawUserAgent","password","cookies","metadata","requestBody"])("rejects extra unbounded or secret %s",key=>expect(adminActivityEventSchema.safeParse({...event,[key]:"forged"}).success).toBe(false));
 it("rejects browser-writable legacy source as canonical attendance",()=>expect(adminActivityEventSchema.safeParse({...event,source:"legacy_audit"}).success).toBe(false));
 it.each(["clicked","completed","success"])("rejects invented outcome %s",outcome=>expect(adminActivityEventSchema.safeParse({...event,outcome}).success).toBe(false));
 it("bounds the source identity",()=>expect(adminActivityEventSchema.safeParse({...event,sourceId:"a".repeat(513)}).success).toBe(false));
});
