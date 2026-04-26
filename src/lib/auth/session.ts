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

const ADMIN_ROLES = new Set(["super_admin", "admin", "content_admin"]);
const OPERATOR_ROLES = new Set(["super_admin", "admin", "content_admin"]);
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

function asClaimString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asClaimNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractClaimSnapshot(claims: Record<string, unknown> | undefined) {
  return {
    adminRole: asClaimString(claims?.jnuits_admin_role),
    memberId: asClaimString(claims?.jnuits_member_id),
    portalRole: asClaimString(claims?.jnuits_portal_role),
    roleVersion: asClaimNumber(claims?.jnuits_role_version),
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
  const claimSnapshot = extractClaimSnapshot(claims);
  const needsDatabaseSnapshot =
    claimRoles.length === 0 ||
    !claimSnapshot.adminRole ||
    !claimSnapshot.portalRole ||
    !claimSnapshot.memberId ||
    claimSnapshot.roleVersion === null;
  const databaseSnapshot = needsDatabaseSnapshot
    ? await resolveDatabaseRoleSnapshot(supabase, userId)
    : null;
  const adminRole = claimSnapshot.adminRole || databaseSnapshot?.adminRole || null;
  const portalRole =
    claimSnapshot.portalRole || databaseSnapshot?.portalRole || null;
  const roles = Array.from(
    new Set(
      [
        ...claimRoles,
        ...(databaseSnapshot?.roles || []),
        adminRole,
        portalRole,
      ].filter((role): role is string => Boolean(role))
    )
  );
  const memberId =
    claimSnapshot.memberId ||
    databaseSnapshot?.memberId ||
    (await resolveDatabaseMemberId(supabase, userId));
  const roleVersion =
    claimSnapshot.roleVersion ?? databaseSnapshot?.roleVersion ?? null;

  return {
    user: {
      adminRole,
      memberId,
      id: userId,
      email,
      portalRole,
      aal,
      rawClaims: claims as Record<string, unknown>,
      roleVersion,
    },
    roles,
  };
}

type DatabaseRoleSnapshot = {
  adminRole: null | string;
  memberId: null | string;
  portalRole: null | string;
  roles: string[];
  roleVersion: null | number;
};

function asSnapshotRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function resolveDatabaseRoleSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<DatabaseRoleSnapshot> {
  if (!userId) {
    return {
      adminRole: null,
      memberId: null,
      portalRole: null,
      roles: [],
      roleVersion: null,
    };
  }

  const { data } = await (supabase as never as {
    rpc: (
      fn: "current_rbac_claims_snapshot"
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  }).rpc("current_rbac_claims_snapshot");
  const snapshot = asSnapshotRecord(data);
  const adminRole = asClaimString(snapshot.jnuits_admin_role);
  const portalRole = asClaimString(snapshot.jnuits_portal_role);
  const roleVersion = asClaimNumber(snapshot.jnuits_role_version);

  return {
    adminRole,
    memberId: asClaimString(snapshot.jnuits_member_id),
    portalRole,
    roles: [adminRole, portalRole].filter((role): role is string =>
      Boolean(role)
    ),
    roleVersion,
  };
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
