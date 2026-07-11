"use server";

import type { User } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  hasAdminRole,
  hasPortalRole,
  resolveScopedNextPath,
} from "@/lib/auth/session";
import {
  AUTH_ACTION_CAPTCHA_MODES,
  enforceAuthActionProtection,
  shouldAttemptPostClaimAutoLogin,
} from "@/lib/auth/action-protection";
import { checkAdminMFA } from "@/lib/auth/mfa";
import { findAuthUserByEmail } from "@/lib/auth/auth-user-lookup";
import { buildPasswordSignInPayload } from "@/lib/auth/password-sign-in";
import { getSafeAuthErrorMessage } from "@/lib/auth/safe-auth-error";
import { getAppBaseUrl } from "@/lib/env";
import type { Database } from "@/lib/db/types";
import { logServerError } from "@/lib/errors/api-error";
import { hashInvitationCode } from "@/lib/members/invitation-code";
import { normalizeJnuitsIdForCreation } from "@/lib/members/jnuits-id";
import { getPasswordPolicyError } from "@/lib/security/password-policy";
import { getPasswordExposureError } from "@/lib/security/pwned-passwords";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
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

const resendConfirmationSchema = z.object({
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
    password: z.string().min(1, "Password is required."),
  })
  .superRefine((value, context) => {
    const policyError = getPasswordPolicyError(value.password);

    if (policyError) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: policyError,
        path: ["password"],
      });
    }
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
  password: z.string().min(1, "Password is required."),
  captchaToken: z.string().trim().optional().default(""),
}).superRefine((value, context) => {
  const policyError = getPasswordPolicyError(value.password, { email: value.email });

  if (policyError) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: policyError,
      path: ["password"],
    });
  }
});

function pickFormFields(formData: FormData, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, asString(formData.get(field))])
  );
}

function encodeMessage(message: string) {
  return encodeURIComponent(message);
}


function getEmailRedirect(pathname: string) {
  return `${getAppBaseUrl()}/auth/confirm?next=${encodeURIComponent(pathname)}`;
}

type AdminClient = ReturnType<typeof createAdminClient>;
type ClaimMemberLookup = Pick<
  Database["public"]["Tables"]["members"]["Row"],
  "email" | "full_name" | "id" | "jnuits_id" | "member_type" | "user_id"
>;

type InvitationLookup = Database["public"]["Tables"]["member_invitations"]["Row"] & {
  recipient_email_snapshot?: string | null;
  members: ClaimMemberLookup | ClaimMemberLookup[] | null;
};

type LoginPortal = "admin" | "portal";

const CLAIM_GENERIC_ERROR =
  "We could not complete your profile claim. Please check your invitation details and try again.";

class SafeProfileClaimError extends Error {
  constructor(readonly safeMessage: string) {
    super(safeMessage);
    this.name = "SafeProfileClaimError";
  }
}

function redirectToRegisterError(message: string): never {
  redirect(`/register?error=${encodeMessage(message)}`);
}

function normalizeEmail(value: null | string | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function asMetadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

async function findMemberByAuthUserId(admin: AdminClient, userId: string) {
  const { data, error } = await asFlexibleClient(admin)
    .from("members")
    .select("id, jnuits_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return (data || null) as { id: string; jnuits_id?: null | string } | null;
}

async function provisionInvitationAuthUser(options: {
  admin: AdminClient;
  email: string;
  invitationId: string;
  member: ClaimMemberLookup;
  password: string;
}) {
  const existingUser = await findAuthUserByEmail(options.admin, options.email);

  if (existingUser) {
    const linkedMember = await findMemberByAuthUserId(options.admin, existingUser.id);

    if (linkedMember && linkedMember.id !== options.member.id) {
      throw new SafeProfileClaimError(
        "This email address is already linked to another JnUITS profile."
      );
    }
  }

  const appMetadata = {
    ...asMetadataRecord(existingUser?.app_metadata),
    claim_invitation_id: options.invitationId,
    claim_member_id: options.member.id,
    claim_source: "member_invitation",
    jnuits_id: options.member.jnuits_id,
  };
  const userMetadata = {
    ...asMetadataRecord(existingUser?.user_metadata),
    full_name: options.member.full_name,
    jnuits_id: options.member.jnuits_id,
  };

  if (existingUser) {
    const { data, error } = await options.admin.auth.admin.updateUserById(
      existingUser.id,
      {
        app_metadata: appMetadata,
        email_confirm: true,
        password: options.password,
        user_metadata: userMetadata,
      }
    );

    if (error || !data.user) {
      throw error || new Error("Supabase Auth user update failed.");
    }

    return data.user;
  }

  const { data, error } = await options.admin.auth.admin.createUser({
    app_metadata: appMetadata,
    email: options.email,
    email_confirm: true,
    password: options.password,
    user_metadata: userMetadata,
  });

  if (error || !data.user) {
    throw error || new Error("Supabase Auth user creation failed.");
  }

  return data.user;
}

async function finalizeInvitationClaim(options: {
  admin: AdminClient;
  authUser: User;
  email: string;
  invitationId: string;
  memberId: string;
}) {
  const { error } = await asFlexibleClient(options.admin).rpc(
    "finalize_member_invitation_claim",
    {
      target_email: options.email,
      target_invitation_id: options.invitationId,
      target_member_id: options.memberId,
      target_user_id: options.authUser.id,
    }
  );

  if (error) throw error;
}

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
    captchaValidation: AUTH_ACTION_CAPTCHA_MODES.passwordSignIn,
    email,
    rateLimit: RATE_LIMITS.authLogin,
    rateLimitPrefix: `auth-login:${portal}`,
    requestHeaders: await headers(),
  });

  if (protectionError) {
    redirectToLoginPage(portal, {
      error: protectionError,
      next: nextPath,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(
    buildPasswordSignInPayload({
      captchaToken: parsed.data.captchaToken,
      email,
      password,
    })
  );

  if (error) {
    logServerError("loginForPortal.signIn", error);
    redirectToLoginPage(portal, {
      error: getSafeAuthErrorMessage(error, "Unable to sign in. Try again."),
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
    logServerError("loginForPortal.refreshSession", refreshError);
    redirectToLoginPage(portal, {
      error: getSafeAuthErrorMessage(
        refreshError,
        "Unable to sign in. Try again."
      ),
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
    captchaValidation: AUTH_ACTION_CAPTCHA_MODES.passwordReset,
    email: parsed.data.email,
    rateLimit: RATE_LIMITS.authPasswordReset,
    rateLimitPrefix: "auth-password-reset",
    requestHeaders: await headers(),
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
    logServerError("requestPasswordReset", error);
    redirect(`/forgot-password?error=${encodeMessage(getSafeAuthErrorMessage(error, "Unable to request a password reset. Try again."))}`);
  }

  redirect("/verify-email?message=Password recovery email sent.");
}

export async function resendSignupConfirmation(formData: FormData) {
  const parsed = resendConfirmationSchema.safeParse(
    pickFormFields(formData, ["email", "captchaToken"])
  );

  if (!parsed.success) {
    redirect(
      `/verify-email?error=${encodeMessage(parsed.error.issues[0]?.message || "Email is required.")}`
    );
  }

  const protectionError = await enforceAuthActionProtection({
    captchaToken: parsed.data.captchaToken,
    captchaValidation: AUTH_ACTION_CAPTCHA_MODES.signupConfirmationResend,
    email: parsed.data.email,
    rateLimit: RATE_LIMITS.authPasswordReset,
    rateLimitPrefix: "auth-resend-signup-confirmation",
    requestHeaders: await headers(),
  });

  if (protectionError) {
    redirect(
      `/verify-email?error=${encodeMessage(protectionError)}&email=${encodeMessage(parsed.data.email)}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    email: parsed.data.email,
    options: {
      captchaToken: parsed.data.captchaToken,
      emailRedirectTo: getEmailRedirect("/portal/dashboard"),
    },
    type: "signup",
  });

  if (error) {
    logServerError("resendSignupConfirmation", error);
    redirect(
      `/verify-email?error=${encodeMessage("Unable to request a confirmation email. Try again or contact JnUITS support.")}&email=${encodeMessage(parsed.data.email)}`
    );
  }

  redirect(
    `/verify-email?message=${encodeMessage("Confirmation email requested. Check your inbox for the newest link.")}&email=${encodeMessage(parsed.data.email)}`
  );
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

  const exposureError = await getPasswordExposureError(parsed.data.password);
  if (exposureError) {
    redirect(`/reset-password?error=${encodeMessage(exposureError)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    logServerError("updatePassword", error);
    redirect(
      `/reset-password?error=${encodeMessage(
        getSafeAuthErrorMessage(error, "Unable to update your password. Try again.")
      )}`
    );
  }

  redirect(
    "/portal/login?message=Password updated. Sign in with your new password."
  );
}

export async function updateCurrentPassword(input: {
  confirmPassword: string;
  nonce?: string;
  password: string;
}) {
  const parsed = updatePasswordSchema.safeParse(input);

  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message || "Choose a stronger password.",
      ok: false as const,
    };
  }

  const exposureError = await getPasswordExposureError(parsed.data.password);
  if (exposureError) {
    return {
      message: exposureError,
      ok: false as const,
    };
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return {
      message: "Your session has expired. Please sign in again.",
      ok: false as const,
    };
  }

  const { error } = await supabase.auth.updateUser({
    nonce: input.nonce?.trim() || undefined,
    password: parsed.data.password,
  });

  if (error) {
    logServerError("updateCurrentPassword", error);
    return {
      message: getSafeAuthErrorMessage(error, "Unable to update your password. Try again."),
      ok: false as const,
    };
  }

  return {
    message: "Password updated for the current signed-in session.",
    ok: true as const,
  };
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
    redirectToRegisterError(
      parsed.error.issues[0]?.message || "All claim fields are required."
    );
  }

  const { email, invitationCode, jnuitsId, password } = parsed.data;
  const protectionError = await enforceAuthActionProtection({
    captchaToken: parsed.data.captchaToken,
    captchaValidation: AUTH_ACTION_CAPTCHA_MODES.memberClaim,
    email,
    rateLimit: RATE_LIMITS.authRegister,
    rateLimitPrefix: "auth-register",
    requestHeaders: await headers(),
  });

  if (protectionError) {
    redirectToRegisterError(protectionError);
  }

  const exposureError = await getPasswordExposureError(password);
  if (exposureError) {
    redirectToRegisterError(exposureError);
  }

  const admin = createAdminClient();

  const invitationResult = await asFlexibleClient(admin)
    .from("member_invitations")
    .select(
      "id, member_id, max_uses, used_count, expires_at, is_active, recipient_email_snapshot, members!inner(id, jnuits_id, user_id, email, full_name, member_type)"
    )
    .eq("code_hash", hashInvitationCode(invitationCode))
    .eq("members.jnuits_id", jnuitsId)
    .is("revoked_at", null)
    .maybeSingle();

  const invitationRow = invitationResult.data as InvitationLookup | null;
  const invitationError = invitationResult.error;

  if (invitationError || !invitationRow) {
    redirectToRegisterError("Invitation code or JnUITS ID is invalid.");
  }

  if (!invitationRow.is_active) {
    redirectToRegisterError("This invitation has been deactivated.");
  }

  if (invitationRow.used_count >= invitationRow.max_uses) {
    redirectToRegisterError("This invitation has already been used.");
  }

  if (new Date(invitationRow.expires_at).getTime() < Date.now()) {
    redirectToRegisterError("This invitation has expired.");
  }

  const linkedMember = Array.isArray(invitationRow.members)
    ? invitationRow.members[0]
    : invitationRow.members;

  if (!linkedMember) {
    redirectToRegisterError("Invitation is missing its linked member.");
  }

  if (linkedMember.user_id) {
    redirect(
      `/portal/login?message=${encodeMessage("This member profile is already claimed. Sign in to continue.")}`
    );
  }

  const expectedEmail = normalizeEmail(
    invitationRow.recipient_email_snapshot || linkedMember.email
  );

  if (!expectedEmail) {
    redirectToRegisterError(
      "This invitation is missing a recipient email. Ask JnUITS support to reissue it."
    );
  }

  if (expectedEmail !== email) {
    redirectToRegisterError("Use the email address that received this invitation.");
  }

  let authUser: User;

  try {
    authUser = await provisionInvitationAuthUser({
      admin,
      email,
      invitationId: invitationRow.id,
      member: linkedMember,
      password,
    });
  } catch (error) {
    logServerError("claimProfile.provisionAuthUser", error);
    redirectToRegisterError(
      error instanceof SafeProfileClaimError ? error.safeMessage : CLAIM_GENERIC_ERROR
    );
  }

  try {
    await finalizeInvitationClaim({
      admin,
      authUser,
      email,
      invitationId: invitationRow.id,
      memberId: linkedMember.id,
    });
  } catch (error) {
    logServerError("claimProfile.finalizeInvitationClaim", error);
    redirectToRegisterError(CLAIM_GENERIC_ERROR);
  }

  const { error: auditError } = await admin.from("audit_events").insert({
    actor_user_id: authUser.id,
    action: "member.profile_claim_finalized",
    entity_type: "member",
    entity_id: linkedMember.id,
    metadata: {
      jnuitsId,
      invitationId: invitationRow.id,
    },
  });

  if (auditError) {
    logServerError("claimProfile.audit", auditError);
  }

  if (!shouldAttemptPostClaimAutoLogin()) {
    redirect(
      `/portal/login?message=${encodeMessage("Profile claimed. Sign in with the password you just created.")}`
    );
  }

  const supabase = await createClient();
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword(
      buildPasswordSignInPayload({
        captchaToken: parsed.data.captchaToken,
        email,
        password,
      })
    );

  if (signInError || !signInData.user) {
    logServerError("claimProfile.signIn", signInError);
    redirect(
      `/portal/login?message=${encodeMessage("Profile claimed. Sign in with the password you just created.")}`
    );
  }

  await supabase.auth.refreshSession();
  await supabase.auth.getClaims();

  revalidatePath("/", "layout");
  redirect("/portal/dashboard?claimed=1");
}


