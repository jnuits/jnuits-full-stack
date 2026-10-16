import{beforeEach,expect,it,vi}from"vitest";
const m=vi.hoisted(()=>({rpc:vi.fn(),ingest:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({rpc:(...args:unknown[])=>{const promise=m.rpc(...args);return Object.assign(promise,{abortSignal:()=>promise});}})}));
vi.mock("./activity/auth-source",()=>({ingestAdminAuthEvents:m.ingest}));
import{runAdminAccountability}from"./accountability-job";
const now=new Date("2026-10-15T04:00:00Z");
beforeEach(()=>{vi.resetAllMocks();m.rpc.mockResolvedValue({data:{claimed:true,leaseId:"9469b123-33aa-44ee-aaaa-333333333333"},error:null});m.ingest.mockResolvedValue({read:500,stored:12,backlog:true,coverage:{state:"partial"}})});
it("bounds collection to500, keeps email independent and releases its lease",async()=>{
 const result=await runAdminAccountability({now,dryRun:false,deadline:new Date(now.getTime()+20000)});
 expect(result.imported).toBe(12);expect(result.backlog).toBe(true);
 expect(m.ingest).toHaveBeenCalledOnce();expect(m.ingest).toHaveBeenCalledWith(expect.objectContaining({limit:500,dryRun:false}));
 expect(m.rpc.mock.calls.map(call=>call[0])).toEqual(["claim_admin_accountability_job","release_admin_accountability_job"]);
});
it("does no work when a concurrent invocation owns the bounded lease",async()=>{
 m.rpc.mockResolvedValue({data:{claimed:false},error:null});expect((await runAdminAccountability({now,dryRun:false,deadline:new Date(now.getTime()+20000)})).errors).toEqual(["job_already_running"]);expect(m.ingest).not.toHaveBeenCalled();
});
it("does no source work after the deadline and never retries a partial collection blindly",async()=>{
 expect((await runAdminAccountability({now,dryRun:false,deadline:now})).errors).toEqual(["deadline_reached"]);expect(m.ingest).not.toHaveBeenCalled();
 m.ingest.mockRejectedValue(new Error("private provider body"));const result=await runAdminAccountability({now,dryRun:false,deadline:new Date(now.getTime()+20000)});
 expect(result.errors).toEqual(["collection_unavailable"]);expect(JSON.stringify(result)).not.toContain("private provider body");expect(m.ingest).toHaveBeenCalledOnce();
 expect(m.rpc.mock.calls.at(-1)?.[1]).toMatchObject({p_failed:true});
});
it("aborts a hanging batch within the work budget, releases the lease and never retries it",async()=>{
 vi.useFakeTimers();
 try{
  let signal:AbortSignal|undefined;
  m.ingest.mockImplementation(({signal:inputSignal}:{signal:AbortSignal})=>{signal=inputSignal;return new Promise(()=>{});});
  const result=runAdminAccountability({now,dryRun:false,deadline:new Date(now.getTime()+100)});
  await vi.advanceTimersByTimeAsync(101);
  expect((await result).errors).toEqual(["deadline_reached"]);
  expect(signal?.aborted).toBe(true);expect(m.ingest).toHaveBeenCalledOnce();
  expect(m.rpc.mock.calls.map(call=>call[0])).toEqual(["claim_admin_accountability_job","release_admin_accountability_job"]);
 }finally{vi.useRealTimers();}
});
