import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks=vi.hoisted(()=>({subscribe:vi.fn(),confirm:vi.fn(),limit:vi.fn()}));
vi.mock("@/lib/newsletter/service",()=>({subscribeNewsletter:mocks.subscribe,confirmNewsletter:mocks.confirm}));
vi.mock("@/lib/auth/session",()=>({getAuthContext:vi.fn()}));
vi.mock("@/lib/security/rate-limit",()=>({checkRateLimitForApi:mocks.limit,getRequestIp:()=>"192.0.2.2"}));
import { POST as subscribe } from "./subscribe/route";
import { POST as confirm } from "./confirm/route";
const context={params:Promise.resolve({})};
function request(path: string,body="{}",origin: string|null="https://jnuits.example.test") {
  return new NextRequest("https://jnuits.example.test/api/newsletter/"+path,{method:"POST",body,headers:origin?{origin,"content-type":"application/json"}:{}});
}
beforeEach(()=>{vi.clearAllMocks();mocks.limit.mockResolvedValue({success:true,resetAt:Date.now()+60000});mocks.subscribe.mockResolvedValue({status:202,body:{message:"If eligible, check email."}});mocks.confirm.mockResolvedValue({status:200,body:{status:"confirmed"}});});
describe.each([["subscribe",subscribe,mocks.subscribe],["confirm",confirm,mocks.confirm]] as const)("newsletter %s route",(path,post,service)=>{
  it.each([null,"https://attacker.example"])("denies missing or cross-site origin %s before any backend work",async origin=>{
    const response=await post(request(path,"{}",origin),context);
    expect(response.status).toBe(403);expect(mocks.limit).not.toHaveBeenCalled();expect(service).not.toHaveBeenCalled();expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("fails closed at the IP limit before subscription work",async()=>{
    mocks.limit.mockResolvedValue({success:false,resetAt:Date.now()+60000});const response=await post(request(path),context);
    expect(response.status).toBe(429);expect(response.headers.get("retry-after")).toBeTruthy();expect(service).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON and oversized bytes without service effects",async()=>{
    expect((await post(request(path,"{"),context)).status).toBe(400);
    expect((await post(request(path,"x".repeat(16385)),context)).status).toBe(413);
    expect(service).not.toHaveBeenCalled();
  });
  it("keeps operation-specific IP limits and returns the service contract without caching",async()=>{
    const response=await post(request(path,JSON.stringify({token:"fixture",email:"consenting@example.test"})),context);
    expect(response.status).toBe(path==="subscribe"?202:200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.limit).toHaveBeenCalledWith("newsletter:"+path+":ip:192.0.2.2",{limit:path==="subscribe"?10:60,windowSeconds:3600});
    expect(service).toHaveBeenCalledOnce();
  });
  it("returns a generic unavailable response on transport failure",async()=>{
    mocks.limit.mockRejectedValue(new Error("private provider detail"));const response=await post(request(path),context);
    expect(response.status).toBe(503);expect(await response.json()).toEqual({error:"newsletter_unavailable"});expect(service).not.toHaveBeenCalled();
  });
});
