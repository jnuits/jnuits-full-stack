import { z } from "zod";
import type { AdminPermission } from "@/lib/admin/access";
import type { AdminOperation, AdminOperationIntent, VerificationClass, VerificationResult } from "./types";

const uuid = z.uuid();
const confirmation = z.string().trim().min(1).max(254);
const reviewNote = z.string().trim().min(1).max(500);
const roleCode = z.enum(["super_admin", "admin", "content_admin"]);
const empty = z.strictObject({});
const target = z.strictObject({ adminProfileId: uuid, confirmation });
const retentionJob = z.strictObject({ jobId: uuid, scope: z.enum(["event", "form"]) });
const invite = z.strictObject({
  displayName: z.string().trim().max(160).default(""),
  email: z.string().trim().max(254).default("").transform(value => value.toLowerCase()),
  inviteMode: z.enum(["email", "member"]).default("email"),
  memberId: z.string().trim().max(80).default(""),
  note: z.string().trim().max(500).default(""), roleCode,
  title: z.string().trim().max(120).default(""),
}).superRefine((value, ctx) => {
  if (value.inviteMode === "email" && !z.email().safeParse(value.email).success) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid admin email." });
  }
  if (value.inviteMode === "member" && !uuid.safeParse(value.memberId).success) {
    ctx.addIssue({ code: "custom", path: ["memberId"], message: "Select a member profile to invite." });
  }
});

type OperationDefinition = { kind: VerificationClass; permission: AdminPermission; label: string; payload: z.ZodType<Record<string, unknown>> };
export const adminOperationRegistry = {
  "membership.request.review": { kind: "routine", permission: "admin.membership.manage", label: "Review membership request", payload: z.strictObject({
    requestId: uuid, expectedUpdatedAt: z.iso.datetime({ offset: true }), decision: z.enum(["approved", "rejected"]), note: reviewNote, confirmation: z.literal("CONFIRM"),
  }) },
  "membership.renewal.confirm": { kind: "protected_mutation", permission: "admin.membership.manage", label: "Confirm membership renewal", payload: z.strictObject({
    memberId: uuid, expectedDueOn: z.iso.date(), resolution: z.enum(["paid", "waived"]),
    reference: z.string().trim().max(96).regex(/^[A-Za-z0-9._/-]*$/).default(""), note: reviewNote, confirmation: z.literal("CONFIRM"),
  }) },
  "admin.role.change": { kind: "admin_role", permission: "admin.roles.manage_admin", label: "Change admin role", payload: target.extend({ roleCode }) },
  "admin.role.invite": { kind: "admin_role", permission: "admin.roles.manage_admin", label: "Invite administrator", payload: invite },
  "admin.role.remove": { kind: "admin_role", permission: "admin.roles.manage_admin", label: "Remove admin access", payload: target },
  "admin.lifecycle.freeze": { kind: "protected_mutation", permission: "admin.roles.manage_admin", label: "Freeze admin access", payload: target },
  "admin.lifecycle.unfreeze": { kind: "protected_mutation", permission: "admin.roles.manage_admin", label: "Restore admin access", payload: target },
  "admin.invitation.revoke": { kind: "protected_mutation", permission: "admin.roles.manage_admin", label: "Cancel admin invitation", payload: z.strictObject({ invitationId: uuid, confirmation }) },
  "admin.security.update": { kind: "protected_mutation", permission: "admin.security.write", label: "Update security policy", payload: z.strictObject({ adminTotpEnforced: z.boolean() }) },
  "admin.security.read": { kind: "protected_read", permission: "admin.security.read", label: "View security settings", payload: empty },
  "admin.system_health.read": { kind: "protected_read", permission: "admin.security.read", label: "View system health", payload: empty },
  "admin.retention.read": { kind: "protected_read", permission: "admin.retention.manage", label: "View retention workspace", payload: empty },
  "admin.retention.discover": { kind: "protected_mutation", permission: "admin.retention.manage", label: "Discover retention jobs", payload: empty },
  "admin.retention.archive": { kind: "protected_mutation", permission: "admin.retention.manage", label: "Archive retention job", payload: retentionJob },
  "admin.retention.approve_purge": { kind: "protected_mutation", permission: "admin.retention.manage", label: "Approve retention purge", payload: retentionJob },
  "admin.retention.purge": { kind: "protected_mutation", permission: "admin.retention.manage", label: "Purge approved retention job", payload: retentionJob.extend({ confirmation: z.literal("PURGE") }) },
} satisfies Record<AdminOperation, OperationDefinition>;

const envelope = z.strictObject({ operation: z.string(), payload: z.record(z.string(), z.unknown()) });
export function parseAdminOperationIntent(input: unknown): VerificationResult<AdminOperationIntent> {
  const parsed = envelope.safeParse(input);
  if (!parsed.success || !Object.hasOwn(adminOperationRegistry, parsed.data.operation)) return { ok: false, code: "operation_invalid" };
  const operation = parsed.data.operation as AdminOperation;
  const payload = adminOperationRegistry[operation].payload.safeParse(parsed.data.payload);
  return payload.success ? { ok: true, value: { operation, payload: payload.data } } : { ok: false, code: "invalid_input" };
}
