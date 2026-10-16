import type {AdminRecommendation} from "@/components/admin/admin-recommendations-card";
import type {ProfileCompletion} from "@/lib/profile/completion";

export type AdminAccountProtectionSummary={enrollment:"configured"|"needs_setup"|"unknown"};
export type PermittedDutyQueue={key:"applications"|"profile_requests"|"blogs";count:number|null;permitted:boolean};
export type AdminRecommendationInputs={
  ownCompletion:{admin:ProfileCompletion;member:ProfileCompletion|null};
  accountProtection:AdminAccountProtectionSummary;
  permittedQueueCounts:readonly PermittedDutyQueue[];
};

const queueCopy:Record<PermittedDutyQueue["key"],{label:string;href:string}>={
  applications:{label:"Review membership applications",href:"/admin/applications"},
  profile_requests:{label:"Review profile requests",href:"/admin/profile-changes"},
  blogs:{label:"Review member blog submissions",href:"/admin/content/blogs"},
};

/** Account-level guidance: deliberately has no session AAL or operation proof. */
export function buildAdminRecommendations(input:AdminRecommendationInputs):AdminRecommendation[] {
  const result:AdminRecommendation[]=[];
  if(input.accountProtection.enrollment==="needs_setup")result.push({
    id:"account-protection",label:"Set up an authenticator",
    explanation:"Add an authenticator to protect your admin account. Each sensitive action keeps its own verification requirements.",
    href:"/admin/mfa/setup",
  });
  if([input.ownCompletion.admin,input.ownCompletion.member].some(completion=>completion?.status==="available"
    &&completion.percent!==null&&completion.percent<100&&completion.missing.length>0))result.push({
    id:"own-profile",label:"Complete your profile details",
    explanation:"Your admin or linked member profile has missing applicable details. Review your personal completion checklist.",
    href:"/admin/settings/profile",
  });
  for(const key of ["applications","profile_requests","blogs"]as const){
    const queue=input.permittedQueueCounts.find(item=>item.key===key&&item.permitted&&item.count!==null&&Number.isSafeInteger(item.count)&&item.count>0);
    if(queue)result.push({id:"queue-"+key,...queueCopy[key],explanation:`${queue.count} pending item${queue.count===1?"":"s"} in a queue you are permitted to review.`});
  }
  return result.slice(0,3);
}

export function adminDigestMonthKey(now:Date) {
  if(!Number.isFinite(now.getTime()))throw new RangeError("Valid digest date required");
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit"}).formatToParts(now);
  return parts.find(part=>part.type==="year")!.value+"-"+parts.find(part=>part.type==="month")!.value;
}
