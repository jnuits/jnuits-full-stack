import {beforeEach,expect,it,vi} from "vitest";
import {deliverAdminNotifications,type DeliveryDependencies} from "./delivery";
const id="9469b123-33aa-44ee-aaaa-222222222222";
let clock:number;
let deps:DeliveryDependencies;
const payload={from:"JnUITS <no-reply@jnuits.org.bd>",replyTo:"no-reply@jnuits.org.bd",to:"fixture@local.invalid",subject:"JnUITS notice",html:"<p>Notice</p>",text:"Notice"};
beforeEach(()=>{
 clock=Date.parse("2026-10-16T04:00Z");
 deps={now:()=>clock,sleep:async ms=>{clock+=ms;},candidates:vi.fn().mockResolvedValue([id]),
 claim:vi.fn().mockResolvedValue({id,claimToken:id,idempotencyKey:"stable-key",payload}),
 validate:vi.fn().mockResolvedValue(true),inspectSuppression:vi.fn().mockResolvedValue(false),
 send:vi.fn().mockResolvedValue({success:true,messageId:"provider-id"}),finish:vi.fn().mockResolvedValue(true),senderMatches:()=>true};
});
it("keeps frozen payload and stable provider key, with a last current-recipient check",async()=>{
 const result=await deliverAdminNotifications({leaseId:id,maxSends:10,deadline:new Date(clock+20000)},deps);
 expect(result.accepted).toBe(1);expect(deps.send).toHaveBeenCalledWith(expect.objectContaining({...payload,idempotencyKey:"stable-key",redactProviderErrors:true}));
 expect(deps.validate).toHaveBeenCalledWith(expect.objectContaining({claimToken:id}));
 expect(deps.finish).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({state:"accepted",messageId:"provider-id"}));
});
it("never sends to revoked or suppressed recipients",async()=>{
 vi.mocked(deps.validate).mockResolvedValue(false);
 expect((await deliverAdminNotifications({leaseId:id,deadline:new Date(clock+20000)},deps)).suppressed).toBe(1);expect(deps.send).not.toHaveBeenCalled();
});
it("fails closed on provider suppression inspection errors",async()=>{
 vi.mocked(deps.inspectSuppression).mockRejectedValue(new Error("private provider body"));
 const result=await deliverAdminNotifications({leaseId:id,deadline:new Date(clock+20000)},deps);expect(deps.send).not.toHaveBeenCalled();expect(JSON.stringify(result)).not.toContain("private");
});
it("does not send a frozen payload under a changed sender configuration",async()=>{
 deps.senderMatches=()=>false;await deliverAdminNotifications({leaseId:id,deadline:new Date(clock+20000)},deps);expect(deps.send).not.toHaveBeenCalled();
});
it("reports lost accepted-response persistence as uncertain and stops the batch",async()=>{
 vi.mocked(deps.candidates).mockResolvedValue([id,"9469b123-33aa-44ee-aaaa-111111111111"]);vi.mocked(deps.finish).mockResolvedValue(false);
 const result=await deliverAdminNotifications({leaseId:id,deadline:new Date(clock+20000)},deps);expect(result.uncertain).toBe(1);expect(result.errors).toContain("receipt_unavailable");expect(deps.send).toHaveBeenCalledOnce();
});
it("persists uncertainty and permanent rejection distinctly without retrying business work",async()=>{
 vi.mocked(deps.send).mockResolvedValue({success:false,failureKind:"uncertain"});
 expect((await deliverAdminNotifications({leaseId:id,deadline:new Date(clock+20000)},deps)).uncertain).toBe(1);
 expect(deps.finish).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({state:"uncertain",failureKind:"uncertain"}));
});
it("bounds attempts to ten and paces every provider request to one per second",async()=>{
 const times:number[]=[];vi.mocked(deps.candidates).mockResolvedValue(Array.from({length:12},(_,i)=>String(i)));
 vi.mocked(deps.inspectSuppression).mockImplementation(async()=>{times.push(clock);return false;});vi.mocked(deps.send).mockImplementation(async()=>{times.push(clock);return {success:true,messageId:"provider"};});
 const result=await deliverAdminNotifications({leaseId:id,maxSends:1000,deadline:new Date(clock+60000)},deps);expect(result.accepted).toBe(10);
 expect(times.every((time,i)=>i===0||time-times[i-1]>=1000)).toBe(true);
});
it("does not claim after a deadline or retry an unclaimed candidate",async()=>{
 expect((await deliverAdminNotifications({leaseId:id,deadline:new Date(clock)},deps)).attempted).toBe(0);expect(deps.claim).not.toHaveBeenCalled();
 vi.mocked(deps.claim).mockResolvedValue(null);await deliverAdminNotifications({leaseId:id,deadline:new Date(clock+20000)},deps);expect(deps.send).not.toHaveBeenCalled();
});
it("shares provider pacing across security and monthly delivery phases",async()=>{
 const times:number[]=[];vi.mocked(deps.inspectSuppression).mockImplementation(async()=>{times.push(clock);return false;});vi.mocked(deps.send).mockImplementation(async()=>{times.push(clock);return{success:true,messageId:"provider"};});
 const pacing={nextProviderCall:0};
 await deliverAdminNotifications({leaseId:id,maxSends:1,deadline:new Date(clock+20000),pacing},deps);
 await deliverAdminNotifications({leaseId:id,maxSends:1,deadline:new Date(clock+20000),pacing},deps);
 expect(times).toHaveLength(4);expect(times.every((time,i)=>i===0||time-times[i-1]>=1000)).toBe(true);
});
