import {normalizeJnuitsIdForCreation} from "@/lib/members/jnuits-id";
import {parseBatchCode} from "@/lib/membership/intake-fields";
import {DEFAULT_COUNTRY,normalizePhoneAnswer,resolvePhoneEntry} from "@/lib/phone";
import type {CompletionEvidence} from "./completion";
export function hasProfileText(value:unknown):boolean {return typeof value==="string" && value.trim().length>0;}
export function memberCompletionEvidence(member:Record<string,unknown>,known:{emailVerified:boolean|null;departmentRecognized:boolean|null}):CompletionEvidence {
  const workplace=[member.current_organization,member.designation,member.work_location];
  const contradictory=member.workplace_applicability==="not_applicable" && workplace.some(hasProfileText);
  const phone=typeof member.phone==="string"?member.phone:"";
  const batch=String(member.batch_no??"").trim();
  return {
    name:typeof member.full_name==="string" && member.full_name.trim().length>=2,
    jnuitsId:typeof member.jnuits_id==="string" && !!normalizeJnuitsIdForCreation(member.jnuits_id),
    email:known.emailVerified,
    department:known.departmentRecognized,
    batch:parseBatchCode(/^\d$/.test(batch)?batch.padStart(2,"0"):batch).ok,
    studentId:hasProfileText(member.student_id),
    photo:hasProfileText(member.avatar_secure_url),
    phone:!!normalizePhoneAnswer(phone) || resolvePhoneEntry(DEFAULT_COUNTRY.dial,phone).status==="ok",
    workplace:workplace.every(hasProfileText),
    workplaceApplicable:contradictory?null:member.workplace_applicability!=="not_applicable",
  };
}
