import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkAdminMFA } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/server";

export type AuthContext = {
  user: null | {
    adminRole: null | string;
    memberId: null | string;
    id: string;
    email: string | null;
    portalRole: null | string;
    aal: string | null;
    rawClaims: Record<string, unknown>;
    roleVersion: null | number;
  };
  roles: string[];
};

const ADMIN_ROLES = new Set([
  "super_admin",
  "admin",
  "content_admin",
  "moderator",
  "content_editor",
  "committee_author",
]);
const OPERATOR_ROLES = new Set([
  "super_admin",
  "admin",
  "content_admin",
  "moderator",
  "content_editor",
  "committee_author",
]);
const PORTAL_ROLES = new Set([
  "member",
  "alumni",
  "executive",
  "alumni_ambassador",
]);

export function resolveSafeNextPath(
  nextPath: null | string | undefined,
  fallbackPath = "/portal"
) {
  if (!nextPath) {
    return fallbackPath;
  }

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return fallbackPath;
  }

  return nextPath;
}

export function hasOperatorRole(roles: string[]) {
  return roles.some((role) => OPERATOR_ROLES.has(role));
}

export function hasAdminRole(roles: string[]) {
  return roles.some((role) => ADMIN_ROLES.has(role));
}

export function hasPortalRole(roles: string[]) {
  return roles.some((role) => PORTAL_ROLES.has(role));
}

export function resolveScopedNextPath(
  nextPath: null | string | undefined,
  allowedPrefixes: string[],
  fallbackPath: string
) {
  const safePath = resolveSafeNextPath(nextPath, fallbackPath);
  const matchesAllowedPrefix = allowedPrefixes.some(
    (prefix) => safePath === prefix || safePath.startsWith(`${prefix}/`)
  );

  return matchesAllowedPrefix ? safePath : fallbackPath;
}

export function resolveLoginPathForRoute(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/")
    ? "/admin/login"
    : "/portal/login";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asClaimString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asClaimNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractClaimSnapshot(
  claims: Record<string, unknown> | undefined,
  appMetadataValue?: unknown
) {
  const appMetadata = asRecord(appMetadataValue ?? claims?.app_metadata);
  const adminRole =
    asClaimString(claims?.jnuits_admin_role) ||
    asClaimString(appMetadata.jnuits_admin_role);
  const portalRole =
    asClaimString(claims?.jnuits_portal_role) ||
    asClaimString(appMetadata.jnuits_portal_role);
  const memberId =
    asClaimString(claims?.jnuits_member_id) ||
    asClaimString(appMetadata.jnuits_member_id);
  const roleVersion =
    asClaimNumber(claims?.jnuits_role_version) ||
    asClaimNumber(appMetadata.jnuits_role_version);

  return {
    adminRole,
    memberId,
    portalRole,
    roleVersion,
  };
}

function extractClaimRoles(claims: Record<string, unknown> | undefined) {
  const snapshot = extractClaimSnapshot(claims);
  return [snapshot.adminRole, snapshot.portalRole].filter(
    (role): role is string => Boolean(role)
  );
}

async function resolveRequestNextPath(fallbackPath: string) {
  const requestHeaders = await headers();
  const requestedPath = requestHeaders.get("x-jnuits-return-to");
  const safePath = resolveSafeNextPath(requestedPath, fallbackPath);

  if (
    fallbackPath !== "/" &&
    !safePath.startsWith(fallbackPath) &&
    safePath !== fallbackPath
  ) {
    return fallbackPath;
  }

  return safePath;
}

export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  if (!sessionUser) {
    return {
      user: null,
      roles: [],
    };
  }

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  const userId = sessionUser.id;
  const email = sessionUser.email ?? asClaimString(claims?.email);
  const aal = asClaimString(claims?.aal);
  const claimRoles = extractClaimRoles(claims);
  const claimSnapshot = extractClaimSnapshot(claims, sessionUser.app_metadata);
  const roles =
    claimRoles.length > 0
      ? claimRoles
      : await resolveDatabaseRoles(supabase, userId);
  const memberId =
    claimSnapshot.memberId || (await resolveDatabaseMemberId(supabase, userId));

  return {
    user: {
      adminRole: claimSnapshot.adminRole,
      memberId,
      id: userId,
      email,
      portalRole: claimSnapshot.portalRole,
      aal,
      rawClaims: claims as Record<string, unknown>,
      roleVersion: claimSnapshot.roleVersion,
    },
    roles,
  };
}

async function resolveDatabaseRoles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data: roleRows } = await supabase
    .from("rbac_user_platform_roles")
    .select("role_id, rbac_platform_roles(code)")
    .eq("user_id", userId)
    .is("revoked_at", null);

  return (roleRows || [])
    .map((row) => {
      const roleRecord = (
        row as {
          rbac_platform_roles?:
            | { code?: string | null }
            | { code?: string | null }[]
            | null;
        }
      ).rbac_platform_roles as
        | { code?: string | null }
        | { code?: string | null }[]
        | null;

      if (Array.isArray(roleRecord)) {
        return typeof roleRecord[0]?.code === "string" ? roleRecord[0].code : null;
      }

      return typeof roleRecord?.code === "string" ? roleRecord.code : null;
    })
    .filter((value): value is string => Boolean(value));
}

async function resolveDatabaseMemberId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  return typeof data?.id === "string" ? data.id : null;
}

async function hasPermissionInternal(
  requestedPermission: string | string[]
): Promise<boolean> {
  const permissions = Array.isArray(requestedPermission)
    ? requestedPermission
    : [requestedPermission];

  if (permissions.length === 0) {
    return true;
  }

  const supabase = await createClient();

  for (const permission of permissions) {
    const { data, error } = await (supabase as never as {
      rpc: (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: boolean | null; error: { message?: string } | null }>;
    }).rpc("has_permission", {
      requested_permission: permission,
    });

    if (!error && data) {
      return true;
    }
  }

  return false;
}

export async function requireAuthenticatedUser(options?: {
  fallbackPath?: string;
}) {
  const fallbackPath = options?.fallbackPath || "/portal";
  const auth = await getAuthContext();

  if (!auth.user) {
    const nextPath = await resolveRequestNextPath(fallbackPath);
    const loginPath = resolveLoginPathForRoute(nextPath);
    redirect(`${loginPath}?next=${encodeURIComponent(nextPath)}`);
  }

  return auth;
}

export async function requireAdminUser(options?: {
  fallbackPath?: string;
}) {
  const auth = await requireAuthenticatedUser({
    fallbackPath: options?.fallbackPath || "/admin",
  });

  if (!hasAdminRole(auth.roles)) {
    redirect("/portal/dashboard");
  }

  return auth;
}

export async function requirePortalUser(options?: {
  fallbackPath?: string;
}) {
  const auth = await requireAuthenticatedUser({
    fallbackPath: options?.fallbackPath || "/portal",
  });

  if (!hasPortalRole(auth.roles)) {
    redirect(hasAdminRole(auth.roles) ? "/admin/dashboard" : "/portal/login");
  }

  return auth;
}

export async function hasPermission(requestedPermission: string | string[]) {
  return hasPermissionInternal(requestedPermission);
}

export async function requireAdminPermission(
  requestedPermission: string | string[],
  options?: {
    fallbackPath?: string;
    requireAal2?: boolean;
  }
) {
  const auth = await requireAdminUser({
    fallbackPath: options?.fallbackPath || "/admin/dashboard",
  });
  const authorized = await hasPermissionInternal(requestedPermission);

  if (!authorized) {
    redirect(options?.fallbackPath || "/admin/dashboard");
  }

  if (options?.requireAal2) {
    const supabase = await createClient();
    const mfaState = await checkAdminMFA(supabase);

    if (!mfaState.ok) {
      redirect(mfaState.redirectTo || "/admin/mfa/challenge");
    }
  }

  return auth;
}

export async function requirePortalPermission(
  requestedPermission: string | string[],
  options?: {
    fallbackPath?: string;
  }
) {
  const auth = await requirePortalUser({
    fallbackPath: options?.fallbackPath || "/portal/dashboard",
  });
  const authorized = await hasPermissionInternal(requestedPermission);

  if (!authorized) {
    redirect(options?.fallbackPath || "/portal/dashboard");
  }

  return auth;
}
