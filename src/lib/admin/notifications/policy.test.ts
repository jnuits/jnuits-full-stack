import {describe,expect,it} from "vitest";
import type {AdminActivityEvent} from "../activity/model";
import {buildAdminSecurityNotice,mayReadPeerNotice,mayEmailPeerNotice} from "./policy";

const owner="9469b123-33aa-44ee-aaaa-222222222222";
const peer="9469b123-33aa-44ee-aaaa-333333333333";
const event:AdminActivityEvent={id:"9469b123-33aa-44ee-aaaa-111111111111",source:"native_auth",sourceId:"9469b123-33aa-44ee-aaaa-111111111111",actorUserId:owner,targetUserId:null,action:"auth.user_updated_password",outcome:"succeeded",occurredAt:"2026-10-16T03:00:00Z",recordedAt:"2026-10-16T03:00:01Z",context:null,provenance:"Verified native provider row"};
const window={cutover:new Date("2026-10-16T00:00:00Z"),now:new Date("2026-10-16T04:00:00Z")};
const recipient={userId:peer,activeAdmin:true,canReadAudit:true,emailVerified:true,emailSuppressed:false,securityEmailOptIn:true};

describe("canonical admin security notice policy",()=>{
 it("uses the native account password event and derives its affected account",()=>{
  const notice=buildAdminSecurityNotice(event,window);
  expect(notice).toMatchObject({kind:"password_changed",affectedUserId:owner,actorUserId:owner,severity:"warning"});
  expect(notice?.href).toMatch(/^\/admin\/audit\?view=activity/);
 });
 it.each(["failed","denied","unknown"]as const)("does not turn %s into a completed-change notice",outcome=>{
  expect(buildAdminSecurityNotice({...event,outcome},window)).toBeNull();
 });
 it("ignores application password receipts, recovery requests and ordinary signins/work",()=>{
  expect(buildAdminSecurityNotice({...event,source:"application_commit"},window)).toBeNull();
  for(const action of ["auth.login","auth.user_recovery_requested","workspace.access","content.notice_created"])
   expect(buildAdminSecurityNotice({...event,action},window)).toBeNull();
 });
 it("does not broadcast backfills, pre-cutover ingestion or future events",()=>{
  expect(buildAdminSecurityNotice({...event,occurredAt:"2026-10-15T23:59:59Z"},window)).toBeNull();
  expect(buildAdminSecurityNotice({...event,recordedAt:"2026-10-15T23:59:59Z"},window)).toBeNull();
  expect(buildAdminSecurityNotice({...event,occurredAt:"2026-10-17T00:00:00Z"},window)).toBeNull();
 });
 it("rejects malformed or mismatched native identity and forbidden extra fields",()=>{
  expect(buildAdminSecurityNotice({...event,actorUserId:null},window)).toBeNull();
  expect(buildAdminSecurityNotice({...event,sourceId:"another-source"},window)).toBeNull();
  expect(buildAdminSecurityNotice({...event,targetUserId:peer},window)).toBeNull();
  expect(buildAdminSecurityNotice({...event,token:"must-not-escape"}as AdminActivityEvent,window)).toBeNull();
 });
 it.each(["admin.role.invite","admin_invitation.accepted","admin.invitation.revoke"])("recognizes the committed invitation boundary %s",action=>{
  expect(buildAdminSecurityNotice({...event,source:"application_commit",sourceId:"operation:fixture",action,targetUserId:peer},window)?.kind).toMatch(/^invitation_/);
 });
 it("keeps unavailable invitation recipients unknown but requires a target for access changes",()=>{
  expect(buildAdminSecurityNotice({...event,source:"application_commit",action:"admin.role.invite"},window)?.affectedUserId).toBeNull();
  expect(buildAdminSecurityNotice({...event,source:"application_commit",action:"admin.role.change"},window)).toBeNull();
  expect(buildAdminSecurityNotice({...event,source:"application_commit",action:"admin.role.change",targetUserId:peer},window)?.kind).toBe("access_changed");
 });
 it.each(["auth.mfa_factor_enrolled","auth.mfa_factor_unenrolled"])("accepts only positively verified native MFA completion %s",action=>{
  expect(buildAdminSecurityNotice({...event,action},window)?.kind).toBe("mfa_changed");
  expect(buildAdminSecurityNotice({...event,action,outcome:"unknown"},window)).toBeNull();
 });
 it("rechecks active audit eligibility for panel notices without inventing access",()=>{
  expect(mayReadPeerNotice(recipient)).toBe(true);
  expect(mayReadPeerNotice({...recipient,activeAdmin:false})).toBe(false);
  expect(mayReadPeerNotice({...recipient,canReadAudit:false})).toBe(false);
 });
 it("requires explicit opt-in, verified address and no suppression each time",()=>{
  const notice=buildAdminSecurityNotice(event,window)!;
  expect(mayEmailPeerNotice(notice,recipient)).toBe(true);
  for(const state of [{securityEmailOptIn:false},{emailVerified:false},{emailSuppressed:true},{canReadAudit:false},{activeAdmin:false}])
   expect(mayEmailPeerNotice(notice,{...recipient,...state})).toBe(false);
 });
 it("never sends an application copy of the native account-holder password email",()=>{
  expect(mayEmailPeerNotice(buildAdminSecurityNotice(event,window)!,{...recipient,userId:owner})).toBe(false);
 });
 it.each(["auth.mfa_factor_enrolled","auth.mfa_factor_unenrolled"])("keeps %s peer mail separate from provider-owned account-holder mail",action=>{
  const notice=buildAdminSecurityNotice({...event,action},window)!;
  expect(mayEmailPeerNotice(notice,{...recipient,userId:owner})).toBe(false);
  expect(mayEmailPeerNotice(notice,recipient)).toBe(true);
 });
});
