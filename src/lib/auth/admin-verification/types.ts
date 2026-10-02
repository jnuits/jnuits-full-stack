export type AdminOperation =
  | "membership.request.review" | "membership.renewal.confirm"
  | "admin.role.change" | "admin.role.invite" | "admin.role.remove"
  | "admin.lifecycle.freeze" | "admin.lifecycle.unfreeze" | "admin.invitation.revoke"
  | "admin.security.update" | "admin.security.read" | "admin.system_health.read"
  | "admin.retention.read" | "admin.retention.discover" | "admin.retention.archive"
  | "admin.retention.approve_purge" | "admin.retention.purge";

export type VerificationMethod = "totp" | "email" | "password";
export type VerificationClass = "routine" | "protected_read" | "protected_mutation" | "admin_role";
export type EnrollmentHistory = "never" | "enrolled" | "unknown";
export type AdminOperationIntent = { operation: AdminOperation; payload: Record<string, unknown> };
export type AdminVerificationActor = {
  userId: string; sessionId: string; email: string; emailConfirmed: boolean;
  roleVersion: number; currentLevel: "aal1" | "aal2";
  enforced: boolean; enrollment: EnrollmentHistory;
};
export type VerificationDecision =
  | { status: "allowed" }
  | { status: "required"; methods: VerificationMethod[] }
  | { status: "denied"; code: string };
export type VerificationProof = { token: string; expiresAt: string };
export type PreparedIntent = {
  id: string; actor: AdminVerificationActor; intent: AdminOperationIntent;
  targetRef: string; payloadDigest: string; policyRevision: string;
};
export type VerificationResult<T> = { ok: true; value: T } | { ok: false; code: string };
