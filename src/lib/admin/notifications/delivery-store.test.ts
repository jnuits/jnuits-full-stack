import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({rpc:vi.fn(),fetch:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({rpc:(...args:unknown[])=>{const p=m.rpc(...args);return Object.assign(p,{abortSignal:()=>p});}})}));
import {AdminDeliveryStore,inspectAdminEmailSuppression} from "./delivery-store";
const id="9469b123-33aa-44ee-aaaa-222222222222";
const claim={id,claimToken:id,idempotencyKey:"stable-key",payload:{from:"JnUITS <no-reply@jnuits.org.bd>",replyTo:"no-reply@jnuits.org.bd",to:"fixture@local.invalid",subject:"Notice",html:"<p>Notice</p>",text:"Notice"}};
beforeEach(()=>{vi.clearAllMocks();m.rpc.mockResolvedValue({data:[id],error:null});});
it("reads bounded ids and validates frozen payloads from atomic claims",async()=>{
 const store=new AdminDeliveryStore(new Date(Date.now()+20000));expect(await store.candidates(id,1000)).toEqual([id]);expect(m.rpc).toHaveBeenCalledWith("list_admin_notification_deliveries",{p_lease_id:id,p_limit:10});
 m.rpc.mockResolvedValue({data:claim,error:null});expect(await store.claim(id,id)).toEqual(claim);
});
it("rejects malformed private state or expired request budgets",async()=>{
 const store=new AdminDeliveryStore(new Date(Date.now()+20000));m.rpc.mockResolvedValue({data:{...claim,payload:{...claim.payload,to:["a@b.test","c@d.test"]}},error:null});await expect(store.claim(id,id)).rejects.toThrow();
 m.rpc.mockClear();await expect(new AdminDeliveryStore(new Date(0)).candidates(id,10)).rejects.toThrow();expect(m.rpc).not.toHaveBeenCalled();
});
it("treats unavailable accepted-response persistence as false without leaking SQL",async()=>{
 const store=new AdminDeliveryStore(new Date(Date.now()+20000));m.rpc.mockResolvedValue({data:null,error:{message:"private"}});expect(await store.finish(claim,{state:"accepted",messageId:"provider"})).toBe(false);
});
it("checks suppression read-only and fails closed on permission or network errors",async()=>{
 m.fetch.mockResolvedValueOnce(new Response(null,{status:404}));expect(await inspectAdminEmailSuppression("fixture@local.invalid",1000,{apiKey:"fixture-key",fetcher:m.fetch})).toBe(false);
 expect(m.fetch).toHaveBeenCalledWith("https://api.resend.com/suppressions/fixture%40local.invalid",expect.objectContaining({method:"GET",redirect:"error"}));
 m.fetch.mockResolvedValueOnce(Response.json({object:"suppression"}));expect(await inspectAdminEmailSuppression("fixture@local.invalid",1000,{apiKey:"fixture-key",fetcher:m.fetch})).toBe(true);
 m.fetch.mockResolvedValueOnce(new Response(null,{status:403}));await expect(inspectAdminEmailSuppression("fixture@local.invalid",1000,{apiKey:"fixture-key",fetcher:m.fetch})).rejects.toThrow("Suppression lookup unavailable");
});
