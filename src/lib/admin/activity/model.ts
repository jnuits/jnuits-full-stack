import {z} from "zod";
export const auditRequestContextSchema=z.strictObject({
 observedIp:z.string().max(45).nullable(),clientIp:z.null(),countryCode:z.null(),
 browser:z.string().max(40).nullable(),os:z.string().max(24).nullable(),deviceClass:z.enum(["desktop","mobile","tablet"]).nullable(),
 networkSource:z.enum(["vercel_edge","unverified","native_provider"]),
});
export type AuditRequestContext=z.infer<typeof auditRequestContextSchema>;
export const adminActivityEventSchema=z.strictObject({
 id:z.uuid(),source:z.enum(["application_commit","native_auth","workspace_entry","workspace_access","admin_signin"]),
 sourceId:z.string().min(1).max(512),actorUserId:z.uuid().nullable(),targetUserId:z.uuid().nullable(),
 action:z.string().min(1).max(160),outcome:z.enum(["succeeded","failed","denied","unknown"]),
 occurredAt:z.iso.datetime({offset:true}),recordedAt:z.iso.datetime({offset:true}),
 context:auditRequestContextSchema.nullable(),provenance:z.string().min(1).max(200),
});
export type AdminActivityEvent=z.infer<typeof adminActivityEventSchema>;
