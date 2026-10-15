export type CompletionKind = "member" | "alumni" | "admin";
export type CompletionField = "name" | "jnuitsId" | "email" | "department" | "batch" | "studentId" | "photo" | "phone" | "workplace";
export type CompletionEvidence = Record<CompletionField, boolean | null> & {workplaceApplicable: boolean | null};
export type ProfileCompletion = {version:1;status:"available"|"unavailable";percent:number|null;completed:number;applicable:number;missing:CompletionField[]};
export type CompletionNextStep = {field:CompletionField;label:string;href:string;mode:"self_edit"|"reviewed_identity"|"support";state:"missing"|"pending_review"|"needs_verification"|"unavailable";focusId?:string};
export function unavailableCompletion(): ProfileCompletion {
  return {version:1,status:"unavailable",percent:null,completed:0,applicable:0,missing:[]};
}
/** A presence rubric, never a permission, identity-proof, or save requirement. */
export function evaluateProfileCompletion(kind:CompletionKind,evidence:CompletionEvidence):ProfileCompletion {
  const checks:CompletionField[] = kind==="admin" ? ["name","email","photo"]
    : ["name","jnuitsId","email","department","batch",...(kind==="member"?["studentId" as const]:[]),"photo","phone",
       ...(evidence.workplaceApplicable===false?[]:["workplace" as const])];
  if ((kind!=="admin" && evidence.workplaceApplicable===null) || checks.some(field=>typeof evidence[field]!=="boolean")) return unavailableCompletion();
  const missing=checks.filter(field=>!evidence[field]);
  const completed=checks.length-missing.length;
  return {version:1,status:"available",percent:Math.round(100*completed/checks.length),completed,applicable:checks.length,missing};
}
