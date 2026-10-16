import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { evaluateProfileCompletion, type CompletionEvidence } from "@/lib/profile/completion";
import { hasProfileText, memberCompletionEvidence } from "@/lib/profile/completion-evidence";
import type { AdminRecommendationInputs } from "./recommendations";

const source = z.object({ admin: z.object({ display_name: z.string().nullable(), avatar_secure_url: z.string().nullable() }),
  emailVerified: z.boolean(), member: z.record(z.string(), z.unknown()).nullable(), departmentRecognized: z.boolean().nullable(),
  enrollment: z.enum(["configured", "needs_setup", "unknown"]),
  queues: z.array(z.object({ key: z.enum(["applications", "profile_requests", "blogs"]), count: z.number().int().nonnegative().nullable(), permitted: z.boolean() })).max(3) });

/** Service/operator adapter. It never constructs a session or calls another user's self loader. */
export async function loadAdminRecommendationInputs(subjectUserId: string, asOf: Date, requireOptIn = true, deadline = new Date(Date.now()+5000)): Promise<AdminRecommendationInputs | null> {
  const budget=deadline.getTime()-Date.now();
  if (!z.uuid().safeParse(subjectUserId).success || !Number.isFinite(asOf.getTime()) || !Number.isFinite(budget) || budget<=0) return null;
  try {
    const request=asFlexibleClient(createAdminClient()).rpc("get_admin_recommendation_inputs", { p_subject: subjectUserId, p_require_opt_in: requireOptIn }) as unknown as {
      abortSignal:(signal:AbortSignal)=>PromiseLike<{data:unknown;error:unknown}>;
    };
    const {data,error}=await request.abortSignal(AbortSignal.timeout(Math.max(1,Math.min(5000,budget))));
    const parsed = source.safeParse(data);
    if (error || !parsed.success) return null;
    const input = parsed.data;
    const admin = evaluateProfileCompletion("admin", { name: hasProfileText(input.admin.display_name), email: input.emailVerified, photo: hasProfileText(input.admin.avatar_secure_url) } as CompletionEvidence);
    const member = input.member ? evaluateProfileCompletion(input.member.lifecycle_status === "alumni" || input.member.member_type === "alumni" ? "alumni" : "member",
      memberCompletionEvidence(input.member, { emailVerified: input.emailVerified, departmentRecognized: input.departmentRecognized })) : null;
    return { ownCompletion: { admin, member }, accountProtection: { enrollment: input.enrollment }, permittedQueueCounts: input.queues };
  } catch { return null; }
}
