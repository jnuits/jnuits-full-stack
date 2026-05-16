"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  hasAdminRole,
  hasPortalRole,
  resolveScopedNextPath,
} from "@/lib/auth/session";
import { checkAdminMFA } from "@/lib/auth/mfa";
import { getAppBaseUrl } from "@/lib/env";
import type { Database } from "@/lib/db/types";
import { hashInvitationCode } from "@/lib/members/invitation-code";
import { normalizeJnuitsIdForCreation } from "@/lib/members/jnuits-id";
import {
  isCaptchaConfigured,
  isCaptchaRequired,
} from "@/lib/security/captcha";
import {
  checkRateLimit,
  getRequestIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .transform((value) => value.toLowerCase()),
  next: z.string().trim().optional().default(""),
  password: z.string().min(1, "Password is required."),
  captchaToken: z.string().trim().optional().default(""),
});

const passwordResetSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .transform((value) => value.toLowerCase()),
  captchaToken: z.string().trim().optional().default(""),
});

const updatePasswordSchema = z
  .object({
    confirmPassword: z.string().min(1, "Confirm your new password."),
    password: z.string().min(8, "Password must be at least 8 characters."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const claimProfileSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .transform((value) => value.toLowerCase()),
  invitationCode: z
    .string()
    .trim()
    .min(4, "Invitation code is required.")
    .max(80)
    .transform((value) => value.toUpperCase()),
  jnuitsId: z
    .string()
    .trim()
    .min(3, "JnUITS ID is required.")
    .max(40)
    .transform((value, context) => {
      const normalized = normalizeJnuitsIdForCreation(value);

      if (!normalized) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "JnUITS ID must use the JnUITS-YYYYSSS format.",
        });
      }

      return normalized;
    }),
  password: z.string().min(8, "Password must be at least 8 characters."),
  captchaToken: z.string().trim().optional().default(""),
});

function pickFormFields(formData: FormData, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, asString(formData.get(field))])
  );
}

function encodeMessage(message: string) {
  return encodeURIComponent(message);
}

async function enforceAuthActionProtection(options: {
  captchaToken: string;
  email?: string;
  rateLimit: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS];
  rateLimitPrefix: string;
}) {
  const requestHeaders = await headers();
  const ip = getRequestIp(requestHeaders);
  const key = `${options.rateLimitPrefix}:${ip}:${options.email || "unknown"}`;
  const rateLimit = checkRateLimit(key, options.rateLimit);

  if (!rateLimit.success) {
    return "Too many attempts. Try again later.";
  }

  if (!isCaptchaRequired() && !isCaptchaConfigured()) {
    return null;
  }

  if (!isCaptchaConfigured()) {
    return "CAPTCHA protection is not configured. Set TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY.";
  }

  return options.captchaToken ? null : "Complete the verification challenge.";
}

function getEmailRedirect(pathname: string) {
  return `${getAppBaseUrl()}/auth/confirm?next=${encodeURIComponent(pathname)}`;
}

type InvitationLookup = Database["public"]["Tables"]["member_invitations"]["Row"] & {
  members:
    | Pick<Database["public"]["Tables"]["members"]["Row"], "id" | "user_id">
    | Pick<Database["public"]["Tables"]["members"]["Row"], "id" | "user_id">[]
    | null;
};

type LoginPortal = "admin" | "portal";

const ADMIN_LOGIN_PREFIXES = ["/admin"];
const PORTAL_LOGIN_PREFIXES = ["/portal", "/profile"];

function getLoginPagePath(portal: LoginPortal) {
  return portal === "admin" ? "/admin/login" : "/portal/login";
}

function getPortalDashboardPath(portal: LoginPortal) {
  return portal === "admin" ? "/admin/dashboard" : "/portal/dashboard";
}

function resolveLoginRedirectPath(portal: LoginPortal, nextPath: string) {
  const fallbackPath = getPortalDashboardPath(portal);
  const scopedPath = resolveScopedNextPath(
    nextPath,
    portal === "admin" ? ADMIN_LOGIN_PREFIXES : PORTAL_LOGIN_PREFIXES,
    fallbackPath
  );

  const rootPath = portal === "admin" ? "/admin" : "/portal";
  if (scopedPath === rootPath || scopedPath === getLoginPagePath(portal)) {
    return fallbackPath;
  }

  return scopedPath;
}

function redirectToLoginPage(
  portal: LoginPortal,
  options: {
    error?: string;
    message?: string;
    next?: string;
  } = {}
): never {
  const searchParams = new URLSearchParams();

  if (options.error) {
    searchParams.set("error", options.error);
  }

  if (options.message) {
    searchParams.set("message", options.message);
  }

  if (options.next) {
    searchParams.set("next", options.next);
  }

  const pathname = getLoginPagePath(portal);
  const query = searchParams.toString();

  redirect(query ? `${pathname}?${query}` : pathname);
}

async function loadActiveRoleCodes(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("rbac_user_platform_roles")
    .select("rbac_platform_roles(code)")
    .eq("user_id", userId)
    .is("revoked_at", null);

  return (data || [])
    .map((row) => {
      const roleRecord = (
        row as {
          rbac_platform_roles?:
            | { code?: string | null }
            | { code?: string | null }[]
            | null;
        }
      ).rbac_platform_roles;

      if (Array.isArray(roleRecord)) {
        return typeof roleRecord[0]?.code === "string" ? roleRecord[0].code : null;
      }

      return typeof roleRecord?.code === "string" ? roleRecord.code : null;
    })
    .filter((value): value is string => Boolean(value));
}

async function loginForPortal(portal: LoginPortal, formData: FormData) {
  const parsed = loginSchema.safeParse(
    pickFormFields(formData, ["email", "password", "next", "captchaToken"])
  );

  if (!parsed.success) {
    redirectToLoginPage(portal, {
      error:
        parsed.error.issues[0]?.message || "Email and password are required.",
    });
  }

  const { email, password } = parsed.data;
  const nextPath = resolveLoginRedirectPath(portal, parsed.data.next);
  const protectionError = await enforceAuthActionProtection({
    captchaToken: parsed.data.captchaToken,
    email,
    rateLimit: RATE_LIMITS.authLogin,
    rateLimitPrefix: `auth-login:${portal}`,
  });

  if (protectionError) {
    redirectToLoginPage(portal, {
      error: protectionError,
      next: nextPath,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    options: {
      captchaToken: parsed.data.captchaToken,
    },
    password,
  });

  if (error) {
    redirectToLoginPage(portal, {
      error: error.message,
      next: nextPath,
    });
  }

  const userId = data.user?.id;
  if (!userId) {
    redirectToLoginPage(portal, {
      error: "Sign-in succeeded, but the user session could not be established.",
      next: nextPath,
    });
  }

  const { error: refreshError } = await supabase.auth.refreshSession();

  if (refreshError) {
    await supabase.auth.signOut();
    redirectToLoginPage(portal, {
      error: refreshError.message,
      next: nextPath,
    });
  }

  await supabase.auth.getClaims();

  const roles = await loadActiveRoleCodes(userId);
  const authorized =
    portal === "admin" ? hasAdminRole(roles) : hasPortalRole(roles);

  if (!authorized) {
    await supabase.auth.signOut();
    redirectToLoginPage(portal, {
      error:
        portal === "admin"
          ? "This account does not have access to the admin portal."
          : "This account does not have access to the member portal.",
      next: nextPath,
    });
  }

  const redirectPath =
    portal === "admin"
      ? (await checkAdminMFA(supabase)).redirectTo || nextPath
      : nextPath;

  revalidatePath("/", "layout");
  redirect(redirectPath);
}

export async function login(formData: FormData) {
  await loginPortal(formData);
}

export async function loginAdmin(formData: FormData) {
  await loginForPortal("admin", formData);
}

export async function loginPortal(formData: FormData) {
  await loginForPortal("portal", formData);
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = passwordResetSchema.safeParse(
    pickFormFields(formData, ["email", "captchaToken"])
  );

  if (!parsed.success) {
    redirect(
      `/forgot-password?error=${encodeMessage(parsed.error.issues[0]?.message || "Email is required.")}`
    );
  }

  const protectionError = await enforceAuthActionProtection({
    captchaToken: parsed.data.captchaToken,
    email: parsed.data.email,
    rateLimit: RATE_LIMITS.authPasswordReset,
    rateLimitPrefix: "auth-password-reset",
  });

  if (protectionError) {
    redirect(`/forgot-password?error=${encodeMessage(protectionError)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    captchaToken: parsed.data.captchaToken,
    redirectTo: getEmailRedirect("/reset-password"),
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeMessage(error.message)}`);
  }

  redirect("/verify-email?message=Password recovery email sent.");
}

export async function updatePassword(formData: FormData) {
  const parsed = updatePasswordSchema.safeParse(
    pickFormFields(formData, ["password", "confirmPassword"])
  );

  if (!parsed.success) {
    redirect(
      `/reset-password?error=${encodeMessage(parsed.error.issues[0]?.message || "New password is required.")}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    redirect(`/reset-password?error=${encodeMessage(error.message)}`);
  }

  redirect(
    "/portal/login?message=Password updated. Sign in with your new password."
  );
}

export async function claimProfile(formData: FormData) {
  const parsed = claimProfileSchema.safeParse(
    pickFormFields(formData, [
      "jnuitsId",
      "invitationCode",
      "email",
      "password",
      "captchaToken",
    ])
  );

  if (!parsed.success) {
    redirect(
      `/register?error=${encodeMessage(parsed.error.issues[0]?.message || "All claim fields are required.")}`
    );
  }

  const { email, invitationCode, jnuitsId, password } = parsed.data;
  const protectionError = await enforceAuthActionProtection({
    captchaToken: parsed.data.captchaToken,
    email,
    rateLimit: RATE_LIMITS.authRegister,
    rateLimitPrefix: "auth-register",
  });

  if (protectionError) {
    redirect(`/register?error=${encodeMessage(protectionError)}`);
  }

  const admin = createAdminClient();

  const invitationResult = await admin
    .from("member_invitations")
    .select("id, member_id, max_uses, used_count, expires_at, is_active, members!inner(id, jnuits_id, user_id)")
    .eq("code_hash", hashInvitationCode(invitationCode))
    .eq("members.jnuits_id", jnuitsId)
    .is("revoked_at", null)
    .maybeSingle();

  const invitationRow = invitationResult.data as InvitationLookup | null;
  const invitationError = invitationResult.error;

  if (invitationError || !invitationRow) {
    redirect("/register?error=Invitation code or JnUITS ID is invalid.");
  }

  if (!invitationRow.is_active) {
    redirect("/register?error=This invitation has been deactivated.");
  }

  if (invitationRow.used_count >= invitationRow.max_uses) {
    redirect("/register?error=This invitation has already been used.");
  }

  if (new Date(invitationRow.expires_at).getTime() < Date.now()) {
    redirect("/register?error=This invitation has expired.");
  }

  const linkedMember = Array.isArray(invitationRow.members)
    ? invitationRow.members[0]
    : invitationRow.members;

  if (!linkedMember) {
    redirect("/register?error=Invitation is missing its linked member.");
  }

  if (linkedMember.user_id) {
    redirect("/register?error=This member profile is already claimed.");
  }

  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken: parsed.data.captchaToken,
      emailRedirectTo: getEmailRedirect("/portal/dashboard"),
      data: {
        claim_invitation_id: invitationRow.id,
        claim_member_id: linkedMember.id,
        claim_source: "member_invitation",
        jnuits_id: jnuitsId,
      },
    },
  });

  if (signUpError || !signUpData.user) {
    redirect(`/register?error=${encodeMessage(signUpError?.message || "Unable to create account.")}`);
  }

  await admin.from("audit_events").insert({
    actor_user_id: signUpData.user.id,
    action: "member.profile_claim_pending",
    entity_type: "member",
    entity_id: linkedMember.id,
    metadata: {
      jnuitsId,
      invitationId: invitationRow.id,
    },
  });

  redirect(
    "/verify-email?message=Account created. Check your email for the confirmation link."
  );
}
