import {expect,it} from "vitest";
import {evaluateDeliveryRetry} from "./delivery-policy";

const now=new Date("2026-10-16T04:00:00Z");
const base={state:"pending"as const,firstAttemptAt:null,leaseUntil:null,lastFailureKind:null,hasUncertainOutcome:false,recipientEligible:true,payloadMatches:true,now};
it("allows an eligible unsent immutable payload",()=>expect(evaluateDeliveryRetry(base)).toEqual({allowed:true}));
it.each(["accepted","delivered","suppressed"]as const)("never resends %s",state=>expect(evaluateDeliveryRetry({...base,state}).allowed).toBe(false));
it("does not send after recipient revocation or payload drift",()=>{
 expect(evaluateDeliveryRetry({...base,recipientEligible:false})).toEqual({allowed:false,reason:"recipient_unavailable"});
 expect(evaluateDeliveryRetry({...base,payloadMatches:false})).toEqual({allowed:false,reason:"payload_changed"});
});
it("keeps an active lease exclusive",()=>expect(evaluateDeliveryRetry({...base,state:"sending",firstAttemptAt:now.toISOString(),leaseUntil:"2026-10-16T04:01:00Z"})).toEqual({allowed:false,reason:"lease_active"}));
it("treats a lost accepted-response write as uncertain once its lease expires",()=>{
 expect(evaluateDeliveryRetry({...base,state:"sending",firstAttemptAt:"2026-10-16T03:00:00Z",leaseUntil:"2026-10-16T03:01:00Z"})).toEqual({allowed:true});
 expect(evaluateDeliveryRetry({...base,state:"sending",firstAttemptAt:"2026-10-15T03:00:00Z",leaseUntil:"2026-10-15T03:01:00Z"})).toEqual({allowed:false,reason:"reconciliation_required"});
});
it("refuses an uncertain retry at/beyond 24 hours, with a safety margin",()=>{
 expect(evaluateDeliveryRetry({...base,state:"uncertain",firstAttemptAt:"2026-10-15T04:00:00Z",hasUncertainOutcome:true})).toEqual({allowed:false,reason:"reconciliation_required"});
 expect(evaluateDeliveryRetry({...base,state:"uncertain",firstAttemptAt:"2026-10-15T04:00:30Z",hasUncertainOutcome:true})).toEqual({allowed:false,reason:"reconciliation_required"});
});
it("does not erase earlier uncertainty after a rate-limit response",()=>{
 expect(evaluateDeliveryRetry({...base,state:"failed",lastFailureKind:"rate_limited",firstAttemptAt:"2026-10-15T03:00:00Z",hasUncertainOutcome:true})).toEqual({allowed:false,reason:"reconciliation_required"});
 expect(evaluateDeliveryRetry({...base,state:"failed",lastFailureKind:"rate_limited",firstAttemptAt:"2026-10-15T03:00:00Z"})).toEqual({allowed:true});
});
it("does not retry permanent rejection or invent an unknown attempt time",()=>{
 expect(evaluateDeliveryRetry({...base,state:"failed",lastFailureKind:"rejected"}).allowed).toBe(false);
 expect(evaluateDeliveryRetry({...base,state:"uncertain",hasUncertainOutcome:true})).toEqual({allowed:false,reason:"reconciliation_required"});
});
