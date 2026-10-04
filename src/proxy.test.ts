import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks=vi.hoisted(()=>({refresh:false}));
vi.mock("@/lib/supabase/config",()=>({getSupabaseUrl:()=>"https://example.test",getSupabasePublishableKey:()=>"fixture-key"}));
vi.mock("@/lib/auth/mfa",()=>({checkAdminMFA:vi.fn()}));
vi.mock("@supabase/ssr",()=>({createServerClient:(_url: string,_key: string,options:{cookies:{setAll:(cookies:unknown[])=>void}})=>({
  auth:{getUser:async()=>{if(mocks.refresh) options.cookies.setAll([{name:"sb-fixture",value:"refreshed",options:{httpOnly:true,sameSite:"lax"}}]);return {data:{user:null}};},getClaims:async()=>({data:null})},
})}));
import { proxy } from "./proxy";
function request(path="/",extra:Record<string,string>={}) {return new NextRequest("https://example.test"+path,{headers:{accept:"text/html","x-nonce":"attacker-nonce","content-security-policy":"script-src * 'unsafe-inline'",...extra}});}
function forwarded(response:Response,key:string){return response.headers.get("x-middleware-request-"+key);}
beforeEach(()=>{mocks.refresh=false;vi.stubEnv("NODE_ENV","production");});
describe("document CSP",()=>{
  it("overwrites spoofed headers with a matching nonce and production CSP",async()=>{
    const response=await proxy(request());const nonce=forwarded(response,"x-nonce");const csp=response.headers.get("content-security-policy")!;
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{32}=?$/);expect(nonce).not.toBe("attacker-nonce");
    expect(forwarded(response,"content-security-policy")).toBe(csp);expect(csp).toContain("'nonce-"+nonce+"'");
    const scripts=csp.split(";").find(value=>value.trim().startsWith("script-src"))!;
    expect(scripts).toContain("'strict-dynamic'");expect(scripts).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("protects HTML detail slugs containing a dot",async()=>{
    const response=await proxy(request("/projects/release.v2"));expect(response.headers.get("content-security-policy")).toContain("strict-dynamic");
  });
  it("issues a new unpredictable nonce for each document",async()=>{
    expect(forwarded(await proxy(request()),"x-nonce")).not.toBe(forwarded(await proxy(request()),"x-nonce"));
  });
  it.each([["/api/newsletter/confirm",{}],["/blogs",{rsc:"1"}],["/blogs",{"next-router-prefetch":"1"}],["/blogs",{purpose:"prefetch"}],["/sitemap.xml",{}]])("strips injected nonce/CSP from non-document request %s %j",async(path,headers)=>{
    const response=await proxy(request(path,headers));expect(forwarded(response,"x-nonce")).toBeNull();expect(forwarded(response,"content-security-policy")).toBeNull();expect(response.headers.get("content-security-policy")).toBeNull();
  });
  it("preserves refreshed session cookies in the response AND rendering headers",async()=>{
    mocks.refresh=true;const response=await proxy(request("/",{cookie:"sb-fixture=old"}));
    expect(response.headers.get("set-cookie")).toContain("sb-fixture=refreshed");expect(forwarded(response,"cookie")).toContain("sb-fixture=refreshed");expect(forwarded(response,"x-nonce")).toBeTruthy();
  });
  it("retains refreshed cookies and policy on protected redirects",async()=>{
    mocks.refresh=true;const response=await proxy(request("/admin/dashboard",{cookie:"sb-fixture=old"}));
    expect(response.status).toBe(307);expect(response.headers.get("set-cookie")).toContain("sb-fixture=refreshed");expect(response.headers.get("content-security-policy")).toContain("'strict-dynamic'");
  });
});
