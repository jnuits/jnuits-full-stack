import {adminActivityEventSchema,type AdminActivityEvent} from "../activity/model";
import type {AdminPeerRecipient,AdminSecurityNoticeIntent} from "./model";

type NoticeCopy=Pick<AdminSecurityNoticeIntent,"kind"|"title"|"summary"|"severity">;
const changes:Record<string,NoticeCopy>={
  "auth.user_updated_password":{kind:"password_changed",title:"Admin account password changed",summary:"A native account password change was recorded.",severity:"warning"},
  "admin.role.invite":{kind:"invitation_created",title:"Admin invitation created",summary:"A verified administrator created an admin invitation.",severity:"info"},
  "admin_invitation.accepted":{kind:"invitation_accepted",title:"Admin invitation accepted",summary:"The recipient accepted an admin invitation through its verified account.",severity:"info"},
  "admin.invitation.revoke":{kind:"invitation_revoked",title:"Admin invitation revoked",summary:"A verified administrator revoked an admin invitation.",severity:"warning"},
  "admin.role.change":{kind:"access_changed",title:"Admin role changed",summary:"An admin account's assigned role changed.",severity:"warning"},
  "admin.lifecycle.freeze":{kind:"access_changed",title:"Admin access frozen",summary:"An admin account's access was frozen.",severity:"warning"},
  "admin.lifecycle.unfreeze":{kind:"access_changed",title:"Admin access restored",summary:"An admin account's access was restored.",severity:"info"},
  "admin.role.remove":{kind:"access_removed",title:"Admin access removed",summary:"An admin account's access was removed.",severity:"critical"},
  "auth.mfa_factor_enrolled":{kind:"mfa_changed",title:"Admin verification method added",summary:"The native provider recorded an added verification method.",severity:"info"},
  "auth.mfa_factor_unenrolled":{kind:"mfa_changed",title:"Admin verification method removed",summary:"The native provider recorded a removed verification method.",severity:"warning"},
};

/** Safe copy only. Legacy/backfilled rows never cause a notification flood. */
export function buildAdminSecurityNotice(input:AdminActivityEvent,{cutover,now}:{cutover:Date;now:Date}):AdminSecurityNoticeIntent|null {
  const parsed=adminActivityEventSchema.safeParse(input);
  if(!parsed.success||!Number.isFinite(cutover.getTime())||!Number.isFinite(now.getTime()))return null;
  const event=parsed.data;
  const occurred=Date.parse(event.occurredAt),recorded=Date.parse(event.recordedAt);
  if(event.outcome!=="succeeded"||!event.actorUserId||occurred<cutover.getTime()||recorded<cutover.getTime()
    ||occurred>now.getTime()||recorded>now.getTime())return null;
  const copy=changes[event.action];
  if(!copy)return null;
  const native=event.action.startsWith("auth.");
  if(native&&(event.source!=="native_auth"||event.sourceId!==event.id
    ||(event.targetUserId!==null&&event.targetUserId!==event.actorUserId)))return null;
  if(!native&&event.source!=="application_commit")return null;
  if((copy.kind==="access_changed"||copy.kind==="access_removed")&&!event.targetUserId)return null;
  return {...copy,eventKey:event.source+":"+event.sourceId,actorUserId:event.actorUserId,
    affectedUserId:native?event.actorUserId:event.targetUserId,occurredAt:event.occurredAt,
    href:"/admin/audit?"+new URLSearchParams({view:"activity",action:event.action,actor:event.actorUserId}).toString()};
}

export function mayReadPeerNotice(recipient:Pick<AdminPeerRecipient,"activeAdmin"|"canReadAudit">) {
  return recipient.activeAdmin&&recipient.canReadAudit;
}

export function mayEmailPeerNotice(notice:AdminSecurityNoticeIntent,recipient:AdminPeerRecipient) {
  return mayReadPeerNotice(recipient)&&recipient.securityEmailOptIn&&recipient.emailVerified&&!recipient.emailSuppressed
    // Account-holder native security mail follows provider settings; peer mail never duplicates it.
    &&!(["password_changed","mfa_changed"].includes(notice.kind)&&notice.affectedUserId===recipient.userId);
}
