import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),inputs:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAdminUser:m.auth}));
vi.mock("@/lib/admin/recommendation-inputs",()=>({loadAdminRecommendationInputs:m.inputs}));
import {AdminRecommendationsSection} from "./admin-recommendations-section";
const uid="9469b123-33aa-44ee-aaaa-222222222222";
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({user:{id:uid}});m.inputs.mockResolvedValue({ownCompletion:{admin:{status:"available",percent:100,missing:[]},member:null},accountProtection:{enrollment:"needs_setup"},permittedQueueCounts:[]});});
it("renders only the authenticated account's checklist without requiring email opt-in",async()=>{
 const result=await AdminRecommendationsSection();expect(m.inputs).toHaveBeenCalledWith(uid,expect.any(Date),false);
 expect(result?.props.recommendations).toEqual([expect.objectContaining({id:"account-protection",href:"/admin/mfa/setup"})]);
});
it("does not manufacture a completed checklist when private source data is unavailable",async()=>{
 m.inputs.mockResolvedValue(null);expect(await AdminRecommendationsSection()).toBeNull();
 m.auth.mockRejectedValue(new Error("denied"));await expect(AdminRecommendationsSection()).rejects.toThrow("denied");
});
