import {afterEach,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({request:vi.fn(),inputs:vi.fn(),deliver:vi.fn(),candidates:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("./delivery-store",()=>({AdminDeliveryStore:class{request=m.request;candidates=m.candidates;},frozenSenderMatches:vi.fn(),inspectAdminEmailSuppression:vi.fn()}));
vi.mock("./delivery",()=>({deliverAdminNotifications:m.deliver}));
vi.mock("@/lib/admin/recommendation-inputs",()=>({loadAdminRecommendationInputs:m.inputs}));
import {runAdminNotificationWork} from "./job";
const uid="9469b123-33aa-44ee-aaaa-222222222222";
beforeEach(()=>{
 vi.stubEnv("RESEND_FROM_EMAIL","JnUITS <no-reply@jnuits.org.bd>");vi.stubEnv("RESEND_REPLY_TO","no-reply@jnuits.org.bd");vi.stubEnv("RESEND_API_KEY","synthetic-key");
 vi.clearAllMocks();m.request.mockImplementation(async(name:string)=>name==="collect_admin_security_notices"?{read:1,created:2,backlog:false}:{enabled:false,notices:[],subjects:[],digestEnd:true});
 m.deliver.mockResolvedValue({attempted:0,accepted:0,suppressed:0,failed:0,uncertain:0,errors:[]});
});
afterEach(()=>vi.unstubAllEnvs());
it("queues security before current Dhaka-month recommendations with durable subject ownership",async()=>{
 const batch={enabled:true,digestEnd:true,notices:[{id:uid,recipientUserId:uid,email:"fixture@local.invalid",title:"Admin role changed",summary:"An account changed.",actorLabel:"Fixture",occurredAt:"2026-10-16T04:00:00Z"}],subjects:[{userId:uid,email:"fixture@local.invalid"}]};
 m.request.mockImplementation(async(name:string)=>name==="collect_admin_security_notices"?{read:1,created:1,backlog:false}:name==="get_admin_notification_batch"?batch:name.startsWith("queue_")?uid:true);
 m.inputs.mockResolvedValue({ownCompletion:{admin:{status:"available",percent:67,missing:["photo"]},member:null},accountProtection:{enrollment:"configured"},permittedQueueCounts:[]});
 m.deliver.mockResolvedValueOnce({attempted:1,accepted:1,errors:[]});
 const result=await runAdminNotificationWork({leaseId:uid,dryRun:false,now:new Date("2026-09-30T18:30:00Z"),deadline:new Date(Date.now()+20000)});
 expect(result.errors).toEqual([]);expect(result.digests).toBe(1);expect(result.sends).toBe(1);
 const names=m.request.mock.calls.map(call=>call[0]);expect(names.indexOf("queue_admin_notice_email")).toBeLessThan(names.indexOf("queue_admin_recommendation_email"));
 expect(m.request).toHaveBeenCalledWith("queue_admin_recommendation_email",expect.objectContaining({p_subject:uid,p_month:"2026-10",p_rubric:1,p_recommendation_ids:["own-profile"]}));
 expect(m.request).toHaveBeenCalledWith("advance_admin_digest_cursor",{p_lease_id:uid,p_month:"2026-10",p_subject:uid,p_reset:true});
 expect(m.deliver).toHaveBeenCalledWith(expect.objectContaining({maxSends:10}),expect.anything());
});
it("does not queue an empty or unavailable recommendation and leaves failed inputs resumable",async()=>{
 m.request.mockImplementation(async(name:string)=>name==="collect_admin_security_notices"?{read:0,created:0,backlog:false}:{enabled:true,digestEnd:true,notices:[],subjects:[{userId:uid,email:"fixture@local.invalid"}]});
 m.inputs.mockResolvedValue({ownCompletion:{admin:{status:"available",percent:100,missing:[]},member:null},accountProtection:{enrollment:"configured"},permittedQueueCounts:[]});
 expect((await runAdminNotificationWork({leaseId:uid,dryRun:false,now:new Date(),deadline:new Date(Date.now()+20000)})).digests).toBe(0);
 expect(m.request.mock.calls.some(call=>call[0]==="queue_admin_recommendation_email")).toBe(false);
 m.request.mockClear();m.inputs.mockResolvedValue(null);
 expect((await runAdminNotificationWork({leaseId:uid,dryRun:false,now:new Date(),deadline:new Date(Date.now()+20000)})).errors).toContain("recommendation_inputs_unavailable");
 expect(m.request.mock.calls.some(call=>call[0]==="advance_admin_digest_cursor")).toBe(false);
});
it("collects panel notices independently of optional email activation",async()=>{
 const result=await runAdminNotificationWork({leaseId:uid,dryRun:false,now:new Date(),deadline:new Date(Date.now()+20000)});
 expect(result.notices).toBe(2);expect(result.sends).toBe(0);expect(m.deliver).not.toHaveBeenCalled();expect(m.inputs).not.toHaveBeenCalled();
 expect(m.request).toHaveBeenCalledWith("collect_admin_security_notices",{p_limit:500,p_dry_run:false,p_lease_id:uid});
});
it("never sends or generates monthly mail from an operator dry run",async()=>{
 await runAdminNotificationWork({leaseId:uid,dryRun:true,now:new Date(),deadline:new Date(Date.now()+20000)});
 expect(m.request).toHaveBeenCalledTimes(1);expect(m.deliver).not.toHaveBeenCalled();
});
it("keeps unavailable private batch data explicit without leaking recipient details",async()=>{
 m.request.mockRejectedValue(new Error("recipient@private.invalid secret"));
 const result=await runAdminNotificationWork({leaseId:uid,dryRun:false,now:new Date(),deadline:new Date(Date.now()+20000)});
 expect(result.errors).toContain("notification_work_unavailable");expect(JSON.stringify(result)).not.toContain("private.invalid");
});
it("does no work once the existing job budget has expired",async()=>{
 await runAdminNotificationWork({leaseId:uid,dryRun:false,now:new Date(),deadline:new Date(0)});expect(m.request).not.toHaveBeenCalled();
});
it("reports a bounded current-month account batch with remaining subjects as backlog",async()=>{
 m.request.mockImplementation(async(name:string)=>name==="collect_admin_security_notices"?{read:0,created:0,backlog:false}:{enabled:true,digestEnd:false,notices:[],subjects:[]});
 const result=await runAdminNotificationWork({leaseId:uid,dryRun:false,now:new Date(),deadline:new Date(Date.now()+20000)});expect(result.backlog).toBe(true);
});
it("gives security delivery an opportunity before slow monthly inputs consume the shared deadline",async()=>{
 vi.useFakeTimers();
 try {
  const now=new Date();let securityProgress=false;
  m.request.mockImplementation(async(name:string)=>name==="collect_admin_security_notices"?{read:0,created:0,backlog:false}:name==="get_admin_notification_batch"?{enabled:true,digestEnd:true,notices:[],subjects:[{userId:uid,email:"fixture@local.invalid"}]}:true);
  m.deliver.mockImplementation(async()=>{securityProgress=true;return{attempted:1,accepted:1,errors:[]};});
  m.inputs.mockImplementation(async()=>{expect(securityProgress).toBe(true);vi.setSystemTime(new Date(now.getTime()+20001));return null;});
  const result=await runAdminNotificationWork({leaseId:uid,dryRun:false,now,deadline:new Date(now.getTime()+20000)});
  expect(securityProgress).toBe(true);expect(result.sends).toBe(1);
 }finally{vi.useRealTimers();}
});
it("keeps an uncertain security send out of the recommendation phase in the same job",async()=>{
 m.request.mockImplementation(async(name:string)=>name==="collect_admin_security_notices"?{read:0,created:0,backlog:false}:{enabled:true,digestEnd:true,notices:[],subjects:[]});
 m.candidates.mockResolvedValue([]);
 m.deliver.mockImplementation(async(options,deps)=>{
  await deps.candidates(uid,options.maxSends);
  return {attempted:1,accepted:0,uncertain:1,errors:[]};
 });
 await runAdminNotificationWork({leaseId:uid,dryRun:false,now:new Date(),deadline:new Date(Date.now()+20000)});
 expect(m.candidates.mock.calls).toEqual([[uid,10,"security"],[uid,9,"recommendation"]]);
 expect(m.deliver.mock.calls[0][0].pacing).toBe(m.deliver.mock.calls[1][0].pacing);
});
