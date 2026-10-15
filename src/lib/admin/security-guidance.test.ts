import {describe,expect,it} from "vitest";
import {buildAdminSecurityGuidance} from "./security-guidance";
import type {AdminVerificationActor} from "@/lib/auth/admin-verification/types";
const actor:AdminVerificationActor={userId:"owner",sessionId:"session",email:"test@local.invalid",emailConfirmed:true,roleVersion:1,currentLevel:"aal1",enforced:false,enrollment:"never"};
describe("native permission-aware MFA guidance",()=>{
 it("does not grant any capability",()=>expect(buildAdminSecurityGuidance({actor,permittedOperations:[]}).capabilities).toEqual([]));
 it.each([["never","setup"],["enrolled","verify"],["unknown","unknown"]] as const)("preserves %s history as %s", (enrollment,state)=>expect(buildAdminSecurityGuidance({actor:{...actor,enrollment},permittedOperations:[]}).state).toBe(state));
 it("distinguishes enrolled factor from current AAL2",()=>expect(buildAdminSecurityGuidance({actor:{...actor,enrollment:"enrolled"},permittedOperations:["admin.role.change"]})).toMatchObject({state:"verify",href:"/admin/mfa/challenge"}));
 it("role changes always require native AAL2 plus current password and exact operation proof",()=>{const g=buildAdminSecurityGuidance({actor:{...actor,currentLevel:"aal2"},permittedOperations:["admin.role.invite","admin.role.change","admin.role.remove"]});expect(g.state).toBe("verified");for(const c of g.capabilities)expect(c.requirements).toEqual(["Existing role permission","Native AAL2 session","Current password","Exact session/intent-bound proof"])});
 it("keeps routine enforcement optional",()=>{expect(buildAdminSecurityGuidance({actor,permittedOperations:["membership.request.review"]}).capabilities[0].requirements).not.toContain("Native AAL2 session");expect(buildAdminSecurityGuidance({actor:{...actor,enforced:true},permittedOperations:["membership.request.review"]}).capabilities[0].requirements).toContain("Native AAL2 session")});
 it("malformed assurance never becomes setup evidence",()=>expect(buildAdminSecurityGuidance({actor:{...actor,currentLevel:"stale"} as unknown as AdminVerificationActor,permittedOperations:[]}).state).toBe("unknown"));
});

 it("gives unknown-enrollment content admins a permitted self-service destination",()=>{
  const guidance=buildAdminSecurityGuidance({actor:{...actor,enrollment:"unknown"},permittedOperations:[]});
  expect(guidance).toMatchObject({state:"unknown",href:"/admin/mfa/setup",capabilities:[]});
  expect(guidance.description).toContain("missing evidence does not mean never enrolled");
 });
