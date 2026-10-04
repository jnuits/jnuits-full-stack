import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNewsletterProvider } from "./provider";
const email="consenting@example.test";
const key="re_newsletter_fixture";
const topic="11111111-1111-4111-8111-111111111111", segment="22222222-2222-4222-8222-222222222222";
const requests: { url: string; init: RequestInit }[]=[];
const fetcher=vi.fn();
beforeEach(() => {
  requests.length=0;fetcher.mockReset();
  vi.stubEnv("RESEND_NEWSLETTER_API_KEY",key);vi.stubEnv("RESEND_NEWSLETTER_TOPIC_ID",topic);vi.stubEnv("RESEND_NEWSLETTER_SEGMENT_ID",segment);
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
function mock(responses: (unknown|Response)[]) {
  fetcher.mockImplementation(async (url: string,init: RequestInit)=>{requests.push({url,init}); const value=responses.shift(); return value instanceof Response?value:Response.json(value);});
  vi.stubGlobal("fetch",fetcher);
  return createNewsletterProvider({sleep:async()=>{}});
}
const missing=()=>new Response("",{status:404});
describe("newsletter Resend suppression and consent boundary",()=>{
  it.each(["bounce","complaint","manual"])("never enrolls a %s-suppressed address",async origin=>{
    const provider=mock([{object:"suppression",id:"blocked",email,origin}]);
    expect(await provider.enroll(email)).toMatchObject({status:"preferences_required"});
    expect(requests.every(item=>item.init.method==="GET")).toBe(true);
  });
  it("never clears global unsubscribe or enrolls the contact",async()=>{
    const provider=mock([missing(),{id:"existing",email,unsubscribed:true}]);
    expect(await provider.enroll(email)).toMatchObject({status:"preferences_required"});
    expect(requests.every(item=>item.init.method==="GET")).toBe(true);
  });
  it("requires a public opt-out Topic before creating any contact",async()=>{
    const provider=mock([missing(),missing(),{id:topic,default_subscription:"opt_in",visibility:"public"}]);
    await expect(provider.enroll(email)).rejects.toThrow("Newsletter provider unavailable");
    expect(requests.every(item=>item.init.method==="GET")).toBe(true);
  });
  it("adds only confirmed consent to the dedicated Topic and Segment",async()=>{
    const provider=mock([missing(),missing(),{id:topic,default_subscription:"opt_out",visibility:"public"},{id:segment},{id:"contact"}, {},{}]);
    expect(await provider.enroll(email)).toEqual({status:"confirmed",contactId:"contact"});
    const writes=requests.filter(item=>item.init.method!=="GET");
    expect(writes.map(item=>[item.url,item.init.method,item.init.body&&JSON.parse(String(item.init.body))])).toEqual([
      ["https://api.resend.com/contacts","POST",{email,unsubscribed:false}],
      ["https://api.resend.com/contacts/contact/topics","PATCH",[{id:topic,subscription:"opt_in"}]],
      ["https://api.resend.com/contacts/contact/segments/"+segment,"POST",undefined],
    ]);
    expect(requests.every(item=>new Headers(item.init.headers).get("Authorization")==="Bearer "+key)).toBe(true);
  });
  it("reuses an existing contact on retry without changing its global preferences",async()=>{
    const provider=mock([missing(),{id:"existing",email,unsubscribed:false},{id:topic,default_subscription:"opt_out",visibility:"public"},{id:segment},{},{}]);
    expect((await provider.enroll(email)).status).toBe("confirmed");
    expect(requests.filter(item=>item.init.method==="POST")).toHaveLength(1);
    expect(requests.some(item=>item.url==="https://api.resend.com/contacts"&&item.init.method==="POST")).toBe(false);
  });
  it("fails closed on suppression transport or malformed contact state",async()=>{
    let provider=mock([new Response("private provider diagnostic",{status:503})]);
    await expect(provider.inspect(email)).rejects.toThrow("Newsletter provider unavailable");
    expect(requests).toHaveLength(1);
    provider=mock([missing(),{id:"existing",email}]);
    await expect(provider.inspect(email)).rejects.toThrow("Newsletter provider unavailable");
  });
  it("partial Segment failure is retryable and never returns confirmed",async()=>{
    const provider=mock([missing(),{id:"existing",email,unsubscribed:false},{id:topic,default_subscription:"opt_out",visibility:"public"},{id:segment},{},new Response("provider private body",{status:429})]);
    await expect(provider.enroll(email)).rejects.toThrow("Newsletter provider unavailable");
    expect(requests.at(-1)?.url).toContain("/segments/");
  });
});
