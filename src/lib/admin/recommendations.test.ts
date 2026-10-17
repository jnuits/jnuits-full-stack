import {describe,expect,it} from "vitest";
import {evaluateProfileCompletion,unavailableCompletion,type CompletionEvidence} from "@/lib/profile/completion";
import {buildAdminRecommendations,adminDigestMonthKey} from "./recommendations";

const full:CompletionEvidence={name:true,jnuitsId:true,email:true,department:true,batch:true,studentId:true,photo:true,phone:true,workplace:true,workplaceApplicable:true};
const admin=evaluateProfileCompletion("admin",full);
const input={ownCompletion:{admin,member:null},accountProtection:{enrollment:"configured"as const},permittedQueueCounts:[]};

describe("personal admin recommendations",()=>{
 it("has no empty recommendations for a complete protected account",()=>expect(buildAdminRecommendations(input)).toEqual([]));
 it("never asks a scheduled recipient to verify a fabricated browser session",()=>{
  const result=buildAdminRecommendations({...input,accountProtection:{enrollment:"needs_setup"}});
  expect(result).toHaveLength(1);expect(result[0]).toMatchObject({id:"account-protection",href:"/admin/mfa/setup"});
  expect(JSON.stringify(result)).not.toMatch(/aal2|verify.*session|password proof/i);
 });
 it("keeps unavailable account/protection evidence unknown",()=>{
  expect(buildAdminRecommendations({...input,ownCompletion:{admin:unavailableCompletion(),member:null},accountProtection:{enrollment:"unknown"}})).toEqual([]);
 });
 it.each(["phone","workplace"]as const)("includes missing member %s through the canonical rubric",field=>{
  const member=evaluateProfileCompletion("member",{...full,[field]:false});
  expect(buildAdminRecommendations({...input,ownCompletion:{admin,member}}).map(x=>x.id)).toContain("own-profile");
 });
 it("does not recommend workplace details after an explicit not-applicable choice",()=>{
  const member=evaluateProfileCompletion("alumni",{...full,workplace:false,workplaceApplicable:false});
  expect(buildAdminRecommendations({...input,ownCompletion:{admin,member}})).toEqual([]);
 });
 it("shows only positively known permitted duty queues",()=>{
  const result=buildAdminRecommendations({...input,permittedQueueCounts:[{key:"applications",count:200,permitted:false},{key:"profile_requests",count:3,permitted:true},{key:"blogs",count:null,permitted:true}]});
  expect(result).toHaveLength(1);expect(result[0]).toMatchObject({id:"queue-profile_requests",href:"/admin/profile-changes"});
  expect(JSON.stringify(result)).not.toContain("200");
 });
 it("prioritizes account protection and own details, bounded to three useful items",()=>{
  const result=buildAdminRecommendations({...input,accountProtection:{enrollment:"needs_setup"},ownCompletion:{admin:evaluateProfileCompletion("admin",{...full,photo:false}),member:null},permittedQueueCounts:[{key:"applications",count:2,permitted:true},{key:"profile_requests",count:3,permitted:true}]});
  expect(result.map(x=>x.id)).toEqual(["account-protection","own-profile","queue-applications"]);
 });
 it("uses the Dhaka calendar month for a durable account/month identity",()=>{
  expect(adminDigestMonthKey(new Date("2026-10-31T17:59:59Z"))).toBe("2026-10");
  expect(adminDigestMonthKey(new Date("2026-10-31T18:00:00Z"))).toBe("2026-11");
  expect(()=>adminDigestMonthKey(new Date("invalid"))).toThrow();
 });
});
