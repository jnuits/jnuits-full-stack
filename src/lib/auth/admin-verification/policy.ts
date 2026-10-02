import type { AdminVerificationActor, VerificationClass, VerificationDecision } from "./types";

/** Permissions and active/live-session checks precede this pure policy decision. */
export function evaluateAdminVerification(actor: AdminVerificationActor, kind: VerificationClass): VerificationDecision {
  if (!["routine", "protected_read", "protected_mutation", "admin_role"].includes(kind)) {
    return { status: "denied", code: "operation_invalid" };
  }
  if (typeof actor.enforced !== "boolean" || !["aal1", "aal2"].includes(actor.currentLevel)
    || !["never", "enrolled", "unknown"].includes(actor.enrollment)) {
    return { status: "denied", code: "verification_unavailable" };
  }
  if (kind === "routine" && !actor.enforced) return { status: "allowed" };
  if (actor.currentLevel === "aal2") {
    return kind === "admin_role" ? { status: "required", methods: ["password"] } : { status: "allowed" };
  }
  if (kind !== "routine" && kind !== "admin_role" && !actor.enforced
    && actor.enrollment === "never" && actor.emailConfirmed) {
    return { status: "required", methods: ["totp", "email"] };
  }
  return { status: "required", methods: ["totp"] };
}
