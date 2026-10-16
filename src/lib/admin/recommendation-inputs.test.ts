import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({rpc:vi.fn(),abort:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({rpc:(...args:unknown[])=>{const promise=m.rpc(...args);return Object.assign(promise,{abortSignal:(signal:AbortSignal)=>{m.abort(signal);return promise;}});}})}));
import {loadAdminRecommendationInputs} from "./recommendation-inputs";
const id="9469b123-33aa-44ee-aaaa-222222222222";
const record={admin:{display_name:"Fixture",avatar_secure_url:null},emailVerified:true,member:null,departmentRecognized:null,enrollment:"needs_setup",queues:[{key:"applications",count:3,permitted:true},{key:"profile_requests",count:null,permitted:false}]};
beforeEach(()=>{vi.clearAllMocks();m.rpc.mockResolvedValue({data:record,error:null});});
it("uses a service-owned adapter with opt-in required and no invented browser session",async()=>{
 const result=await loadAdminRecommendationInputs(id,new Date("2026-10-16T05:00Z"));
 expect(m.rpc).toHaveBeenCalledWith("get_admin_recommendation_inputs",{p_subject:id,p_require_opt_in:true});
 expect(result?.accountProtection).toEqual({enrollment:"needs_setup"});expect(result?.ownCompletion.admin.missing).toEqual(["photo"]);
 expect(result).not.toHaveProperty("currentLevel");expect(result?.ownCompletion.member).toBeNull();
});
it("shares canonical phone and not-applicable workplace completion",async()=>{
 m.rpc.mockResolvedValue({data:{...record,departmentRecognized:true,member:{full_name:"Fixture Member",jnuits_id:"JnUITS-2023001",department_code:"CSE",batch_no:12,student_id:"2023",avatar_secure_url:"https://img.test/a.jpg",phone:"01776387624",workplace_applicability:"not_applicable",member_type:"alumni",lifecycle_status:"alumni"}},error:null});
 const result=await loadAdminRecommendationInputs(id,new Date());expect(result?.ownCompletion.member?.percent).toBe(100);
});
it("fails closed for inactive, opted-out, unavailable or malformed source data",async()=>{
 for(const response of [{data:null,error:null},{data:record,error:{code:"unavailable"}},{data:{},error:null}]){m.rpc.mockResolvedValue(response);expect(await loadAdminRecommendationInputs(id,new Date())).toBeNull();}
});
it("rejects malformed subject ids and time without querying another account",async()=>{
 expect(await loadAdminRecommendationInputs("bad",new Date())).toBeNull();expect(await loadAdminRecommendationInputs(id,new Date(NaN))).toBeNull();expect(m.rpc).not.toHaveBeenCalled();
});
it("gives the native request a bounded abort signal and never starts after the shared job deadline",async()=>{
 expect(await loadAdminRecommendationInputs(id,new Date(),true,new Date(0))).toBeNull();expect(m.rpc).not.toHaveBeenCalled();
 expect(await loadAdminRecommendationInputs(id,new Date())).not.toBeNull();expect(m.abort).toHaveBeenCalledWith(expect.any(AbortSignal));
});
